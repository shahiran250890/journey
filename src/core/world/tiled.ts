import { pixelToTile } from './projection.ts';
import type { IsoMetrics } from './projection.ts';
import type {
  MapMarker,
  MapTile,
  Shape,
  SpawnPoint,
  Tileset,
  TilesetTile,
  Vec,
  ZoneMap,
  ZoneTrigger,
} from './types.ts';

const FLIP_MASK = 0x1fffffff;

type PropertyValue = string | number | boolean;

/**
 * Read a Tiled isometric map. Tile layers named ground and props are drawn.
 * A tile layer named collision, or any tile layer with blocks=true, becomes
 * one rectangle per occupied cell. Object layers named collision, triggers,
 * spawns, and markers carry shapes, zone exits, spawn points, and labels.
 * Object geometry is converted from Tiled's isometric pixels into tile space.
 */
export function parseTiledMap(
  mapJson: unknown,
  externalTilesets: Readonly<Record<string, unknown>> = {},
): ZoneMap {
  const map = record(mapJson, 'map');
  if (map.orientation !== 'isometric') throw new Error('map must be isometric');
  if (map.infinite === true) throw new Error('infinite maps are not supported');
  const width = positiveInt(map.width, 'width');
  const height = positiveInt(map.height, 'height');
  const tileWidth = positiveInt(map.tilewidth, 'tilewidth');
  const tileHeight = positiveInt(map.tileheight, 'tileheight');
  const metrics: IsoMetrics = { tileWidth, tileHeight, columns: width, rows: height };
  const id = requireString(propertiesOf(map), 'zoneId', 'map');
  const tilesets = resolveTilesets(map, externalTilesets);
  const ground: MapTile[] = [];
  const props: MapTile[] = [];
  const blockers: Shape[] = [];
  const triggers: ZoneTrigger[] = [];
  const spawns: SpawnPoint[] = [];
  const markers: MapMarker[] = [];
  const layers = arrayOf(map.layers, 'layers');
  for (const layerValue of layers) {
    const layer = record(layerValue, 'layer');
    const name = typeof layer.name === 'string' ? layer.name : '';
    const layerProperties = propertiesOf(layer);
    if (layer.type === 'tilelayer') {
      readTileLayer(layer, name, layerProperties, width, height, tilesets, ground, props, blockers);
      continue;
    }
    if (layer.type === 'objectgroup') {
      readObjectLayer(layer, name, metrics, blockers, triggers, spawns, markers);
      continue;
    }
    throw new Error(`unsupported layer ${name || '(unnamed)'}`);
  }
  return {
    id,
    width,
    height,
    tileWidth,
    tileHeight,
    ground,
    props,
    blockers,
    triggers,
    spawns,
    markers,
  };
}

export function parseTileset(tilesetJson: unknown): Tileset {
  const tileset = record(tilesetJson, 'tileset');
  const name = typeof tileset.name === 'string' ? tileset.name : 'tileset';
  return { name, tiles: [...indexTiles(tileset).values()].sort((a, b) => a.id - b.id) };
}

function readTileLayer(
  layer: Record<string, unknown>,
  name: string,
  props: ReadonlyMap<string, PropertyValue>,
  width: number,
  height: number,
  tilesets: readonly ResolvedTileset[],
  ground: MapTile[],
  propsOut: MapTile[],
  blockers: Shape[],
): void {
  const data = layer.data;
  if (typeof data === 'string') throw new Error(`${name} uses compressed tile data`);
  if (!Array.isArray(data)) throw new Error(`${name} is missing tile data`);
  if (data.length !== width * height) {
    throw new Error(`${name} has ${data.length} tiles, expected ${width * height}`);
  }
  const blocks = name === 'collision' || props.get('blocks') === true;
  const visual = name === 'ground' ? ground : name === 'props' ? propsOut : null;
  if (!blocks && !visual) return;
  for (let index = 0; index < data.length; index += 1) {
    const gid = data[index];
    if (typeof gid !== 'number') throw new Error(`${name} has a non-numeric tile`);
    if ((gid & FLIP_MASK) === 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (blocks) {
      blockers.push({ kind: 'aabb', minX: x, minY: y, maxX: x + 1, maxY: y + 1 });
    }
    if (visual) visual.push({ x, y, tileId: tileIdFor(gid, tilesets) });
  }
}

function readObjectLayer(
  layer: Record<string, unknown>,
  name: string,
  metrics: IsoMetrics,
  blockers: Shape[],
  triggers: ZoneTrigger[],
  spawns: SpawnPoint[],
  markers: MapMarker[],
): void {
  const objects = layer.objects;
  if (objects === undefined) return;
  if (!Array.isArray(objects)) throw new Error(`${name} objects must be an array`);
  for (const value of objects) {
    const object = record(value, `${name} object`);
    if (typeof object.rotation === 'number' && object.rotation !== 0) {
      throw new Error(`${objectLabel(object)} is rotated, which is not supported`);
    }
    const objectName = typeof object.name === 'string' ? object.name : '';
    const props = propertiesOf(object);
    if (name === 'collision') {
      blockers.push(objectShape(object, metrics));
      continue;
    }
    if (name === 'triggers') {
      triggers.push({
        id: objectName || String(object.id ?? triggers.length + 1),
        targetZone: requireString(props, 'targetZone', objectLabel(object)),
        targetSpawn: requireString(props, 'targetSpawn', objectLabel(object)),
        shape: objectShape(object, metrics),
      });
      continue;
    }
    if (name === 'spawns') {
      if (objectName.trim() === '') throw new Error('a spawn point is missing a name');
      if (spawns.some((spawn) => spawn.id === objectName)) {
        throw new Error(`duplicate spawn ${objectName}`);
      }
      const point = objectAnchor(object, metrics);
      spawns.push({ id: objectName, x: point.x, y: point.y });
      continue;
    }
    if (name === 'markers') {
      const kind = objectClass(object) || stringProp(props, 'kind') || 'marker';
      const anchor = objectAnchor(object, metrics);
      const shaped = object.point === true ? null : tryShape(object, metrics);
      markers.push({
        id: objectName || `${kind}-${markers.length + 1}`,
        kind,
        x: anchor.x,
        y: anchor.y,
        shape: shaped,
        properties: Object.fromEntries(props),
      });
    }
  }
}

function tryShape(object: Record<string, unknown>, metrics: IsoMetrics): Shape | null {
  if (object.point === true) return null;
  if (Array.isArray(object.polygon) || object.ellipse === true) return objectShape(object, metrics);
  const width = typeof object.width === 'number' ? object.width : 0;
  const height = typeof object.height === 'number' ? object.height : 0;
  if (width === 0 && height === 0) return null;
  return objectShape(object, metrics);
}

function objectShape(object: Record<string, unknown>, metrics: IsoMetrics): Shape {
  if (Array.isArray(object.polygon)) {
    return { kind: 'polygon', points: absolutePoints(object, object.polygon, metrics) };
  }
  if (object.ellipse === true) {
    return { kind: 'polygon', points: ellipsePoints(object, metrics) };
  }
  const x = numberField(object, 'x');
  const y = numberField(object, 'y');
  const width = numberField(object, 'width');
  const height = numberField(object, 'height');
  if (width === 0 || height === 0) throw new Error(`${objectLabel(object)} has no area`);
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  return {
    kind: 'polygon',
    points: corners.map((corner) => pixelToTile(corner.x, corner.y, metrics)),
  };
}

function objectAnchor(object: Record<string, unknown>, metrics: IsoMetrics): Vec {
  if (Array.isArray(object.polygon)) {
    const points = absolutePoints(object, object.polygon, metrics);
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    return { x, y };
  }
  const x = numberField(object, 'x');
  const y = numberField(object, 'y');
  const width = typeof object.width === 'number' ? object.width : 0;
  const height = typeof object.height === 'number' ? object.height : 0;
  return pixelToTile(x + width / 2, y + height / 2, metrics);
}

function absolutePoints(
  object: Record<string, unknown>,
  raw: readonly unknown[],
  metrics: IsoMetrics,
): Vec[] {
  const originX = numberField(object, 'x');
  const originY = numberField(object, 'y');
  if (raw.length < 3) throw new Error(`${objectLabel(object)} polygon needs at least 3 points`);
  return raw.map((value) => {
    const point = record(value, 'polygon point');
    return pixelToTile(
      originX + numberField(point, 'x'),
      originY + numberField(point, 'y'),
      metrics,
    );
  });
}

function ellipsePoints(object: Record<string, unknown>, metrics: IsoMetrics): Vec[] {
  const x = numberField(object, 'x');
  const y = numberField(object, 'y');
  const width = numberField(object, 'width');
  const height = numberField(object, 'height');
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const points: Vec[] = [];
  const steps = 12;
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    points.push(
      pixelToTile(
        centerX + Math.cos(angle) * (width / 2),
        centerY + Math.sin(angle) * (height / 2),
        metrics,
      ),
    );
  }
  return points;
}

interface ResolvedTileset {
  firstgid: number;
  tiles: Map<number, TilesetTile>;
}

function resolveTilesets(
  map: Record<string, unknown>,
  externalTilesets: Readonly<Record<string, unknown>>,
): ResolvedTileset[] {
  const entries = arrayOf(map.tilesets, 'tilesets');
  if (entries.length === 0) throw new Error('map has no tileset');
  return entries.map((value) => {
    const entry = record(value, 'tileset');
    if (typeof entry.firstgid !== 'number') throw new Error('tileset is missing firstgid');
    if (typeof entry.source === 'string') {
      const source = externalTilesets[entry.source];
      if (!isRecord(source)) throw new Error(`missing external tileset ${entry.source}`);
      return { firstgid: entry.firstgid, tiles: indexTiles(source) };
    }
    return { firstgid: entry.firstgid, tiles: indexTiles(entry) };
  });
}

function indexTiles(tileset: Record<string, unknown>): Map<number, TilesetTile> {
  const tiles = new Map<number, TilesetTile>();
  const raw = tileset.tiles;
  if (!Array.isArray(raw)) return tiles;
  for (const value of raw) {
    const tile = record(value, 'tile');
    if (typeof tile.id !== 'number') throw new Error('tile is missing an id');
    if (typeof tile.image !== 'string' || tile.image.length === 0) {
      throw new Error(`tile ${tile.id} is missing an image`);
    }
    const props = propertiesOf(tile);
    const originX = props.get('originX');
    const originY = props.get('originY');
    tiles.set(tile.id, {
      id: tile.id,
      image: tile.image,
      imageWidth: positiveInt(tile.imagewidth, `tile ${tile.id} imagewidth`),
      imageHeight: positiveInt(tile.imageheight, `tile ${tile.id} imageheight`),
      originX: typeof originX === 'number' ? originX : 0.5,
      originY: typeof originY === 'number' ? originY : 1,
    });
  }
  return tiles;
}

function tileIdFor(gid: number, tilesets: readonly ResolvedTileset[]): number {
  const raw = gid & FLIP_MASK;
  let found: ResolvedTileset | undefined;
  for (const tileset of tilesets) {
    if (tileset.firstgid <= raw && (!found || tileset.firstgid > found.firstgid)) found = tileset;
  }
  if (!found) throw new Error(`tile gid ${raw} does not belong to a tileset`);
  return raw - found.firstgid;
}

function propertiesOf(value: Record<string, unknown>): Map<string, PropertyValue> {
  const out = new Map<string, PropertyValue>();
  if (value.properties === undefined) return out;
  for (const entryValue of arrayOf(value.properties, 'properties')) {
    const entry = record(entryValue, 'property');
    if (typeof entry.name !== 'string') throw new Error('property is missing a name');
    const propValue = entry.value;
    if (
      typeof propValue !== 'string' &&
      typeof propValue !== 'number' &&
      typeof propValue !== 'boolean'
    ) {
      throw new Error(`property ${entry.name} has an unsupported value`);
    }
    out.set(entry.name, propValue);
  }
  return out;
}

function requireString(
  props: ReadonlyMap<string, PropertyValue>,
  name: string,
  owner: string,
): string {
  const value = props.get(name);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${owner} is missing ${name}`);
  }
  return value;
}

function stringProp(props: ReadonlyMap<string, PropertyValue>, name: string): string {
  const value = props.get(name);
  return typeof value === 'string' ? value : '';
}

function objectClass(object: Record<string, unknown>): string {
  if (typeof object.class === 'string') return object.class;
  if (typeof object.type === 'string') return object.type;
  return '';
}

function objectLabel(object: Record<string, unknown>): string {
  if (typeof object.name === 'string' && object.name.length > 0) return object.name;
  return 'object';
}

function arrayOf(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function numberField(value: Record<string, unknown>, name: string): number {
  const found = value[name];
  if (typeof found !== 'number' || !Number.isFinite(found)) {
    throw new Error(`expected a number for ${name}`);
  }
  return found;
}

function positiveInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
