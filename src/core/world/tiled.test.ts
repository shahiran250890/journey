import { describe, expect, it } from 'vitest';
import { isoProject, pixelToTile } from './projection.ts';
import { parseTiledMap } from './tiled.ts';
import { circleHitsShape } from './collision.ts';

const metrics = { tileWidth: 64, tileHeight: 32, columns: 8, rows: 6 };

function tileLayer(name: string, data: number[], extra: Record<string, unknown> = {}) {
  return {
    name,
    type: 'tilelayer',
    width: metrics.columns,
    height: metrics.rows,
    data,
    ...extra,
  };
}

function empty(): number[] {
  return Array.from({ length: metrics.columns * metrics.rows }, () => 0);
}

const tileset = {
  columns: 0,
  name: 'test',
  tilecount: 2,
  tiles: [
    { id: 0, image: 'tiles/grass.png', imagewidth: 64, imageheight: 32 },
    { id: 1, image: 'tiles/tree.png', imagewidth: 96, imageheight: 128 },
  ],
};

function baseMap(layers: unknown[]) {
  return {
    orientation: 'isometric',
    width: metrics.columns,
    height: metrics.rows,
    tilewidth: metrics.tileWidth,
    tileheight: metrics.tileHeight,
    properties: [{ name: 'zoneId', type: 'string', value: 'town' }],
    tilesets: [{ firstgid: 1, source: 'journey-iso.tsj' }],
    layers,
  };
}

describe('parseTiledMap', () => {
  it('reads ground, props, and a blocking tile layer into tile space', () => {
    const ground = empty();
    ground[0] = 1;
    const props = empty();
    props[metrics.columns + 2] = 2;
    const collision = empty();
    collision[metrics.columns + 2] = 1;
    const map = parseTiledMap(
      baseMap([
        tileLayer('ground', ground),
        tileLayer('props', props),
        tileLayer('collision', collision, { visible: false }),
      ]),
      { 'journey-iso.tsj': tileset },
    );
    expect(map.id).toBe('town');
    expect(map.ground).toEqual([{ x: 0, y: 0, tileId: 0 }]);
    expect(map.props).toEqual([{ x: 2, y: 1, tileId: 1 }]);
    expect(map.blockers).toEqual([{ kind: 'aabb', minX: 2, minY: 1, maxX: 3, maxY: 2 }]);
  });

  it('converts an isometric polygon trigger and a spawn point into tile space', () => {
    const spawnTile = { x: 3.5, y: 2.5 };
    const spawnPixel = isoProject(spawnTile.x, spawnTile.y, metrics);
    const corners = [
      { x: 4, y: 1 },
      { x: 6, y: 1 },
      { x: 6, y: 3 },
      { x: 4, y: 3 },
    ].map((corner) => isoProject(corner.x, corner.y, metrics));
    const origin = corners[0]!;
    const map = parseTiledMap(
      baseMap([
        tileLayer(
          'ground',
          empty().map(() => 1),
        ),
        {
          name: 'triggers',
          type: 'objectgroup',
          objects: [
            {
              id: 1,
              name: 'gate',
              type: 'zone-exit',
              x: origin.x,
              y: origin.y,
              polygon: corners.map((corner) => ({
                x: corner.x - origin.x,
                y: corner.y - origin.y,
              })),
              properties: [
                { name: 'targetZone', type: 'string', value: 'overworld' },
                { name: 'targetSpawn', type: 'string', value: 'from-town' },
              ],
            },
          ],
        },
        {
          name: 'spawns',
          type: 'objectgroup',
          objects: [
            {
              id: 2,
              name: 'default',
              point: true,
              x: spawnPixel.x,
              y: spawnPixel.y,
              width: 0,
              height: 0,
            },
          ],
        },
      ]),
      { 'journey-iso.tsj': tileset },
    );
    const trigger = map.triggers[0];
    expect(trigger).toMatchObject({
      id: 'gate',
      targetZone: 'overworld',
      targetSpawn: 'from-town',
    });
    expect(trigger?.shape.kind).toBe('polygon');
    if (trigger?.shape.kind === 'polygon') {
      expect(trigger.shape.points[0]).toEqual({ x: 4, y: 1 });
      expect(trigger.shape.points[2]).toEqual({ x: 6, y: 3 });
      expect(circleHitsShape({ x: 5, y: 2 }, 0.2, trigger.shape)).toBe(true);
      expect(circleHitsShape({ x: 1, y: 1 }, 0.2, trigger.shape)).toBe(false);
    }
    expect(map.spawns[0]?.x).toBeCloseTo(spawnTile.x);
    expect(map.spawns[0]?.y).toBeCloseTo(spawnTile.y);
    expect(pixelToTile(spawnPixel.x, spawnPixel.y, metrics)).toEqual(spawnTile);
  });

  it('rejects a non-isometric map and a missing tileset', () => {
    expect(() => parseTiledMap({ ...baseMap([]), orientation: 'orthogonal' })).toThrow(/isometric/);
    expect(() => parseTiledMap(baseMap([tileLayer('ground', empty())]))).toThrow(/tileset/);
  });
});
