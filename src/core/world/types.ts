export interface Vec {
  x: number;
  y: number;
}

export interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Shape =
  | ({ kind: 'aabb' } & Aabb)
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'polygon'; points: readonly Vec[] };

export interface MapTile {
  x: number;
  y: number;
  tileId: number;
}

export interface ZoneTrigger {
  id: string;
  targetZone: string;
  targetSpawn: string;
  shape: Shape;
}

export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
}

export interface MapMarker {
  id: string;
  kind: string;
  x: number;
  y: number;
  shape: Shape | null;
  properties: Readonly<Record<string, string | number | boolean>>;
}

export interface ZoneMap {
  id: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  ground: readonly MapTile[];
  props: readonly MapTile[];
  blockers: readonly Shape[];
  triggers: readonly ZoneTrigger[];
  spawns: readonly SpawnPoint[];
  markers: readonly MapMarker[];
}

export interface TilesetTile {
  id: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
  originX: number;
  originY: number;
}

export interface Tileset {
  name: string;
  tiles: readonly TilesetTile[];
}
