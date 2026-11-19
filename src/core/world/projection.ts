export interface IsoMetrics {
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
}

/**
 * Fixed-angle isometric projection used by Tiled.
 * The origin is the top corner of the map, so a non-square map stays
 * inside positive screen coordinates. Square maps match the Milestone 0 grid.
 */
export function isoProject(x: number, y: number, metrics: IsoMetrics): { x: number; y: number } {
  const originX = (metrics.rows * metrics.tileWidth) / 2;
  return {
    x: originX + (x - y) * (metrics.tileWidth / 2),
    y: (x + y) * (metrics.tileHeight / 2),
  };
}

export function isoMapSize(metrics: IsoMetrics): { width: number; height: number } {
  return {
    width: ((metrics.columns + metrics.rows) * metrics.tileWidth) / 2,
    height: ((metrics.columns + metrics.rows) * metrics.tileHeight) / 2,
  };
}

/** Inverse of isoProject. Pixel coordinates are Tiled's isometric object space. */
export function pixelToTile(x: number, y: number, metrics: IsoMetrics): { x: number; y: number } {
  const originX = (metrics.rows * metrics.tileWidth) / 2;
  return {
    x: y / metrics.tileHeight + (x - originX) / metrics.tileWidth,
    y: y / metrics.tileHeight - (x - originX) / metrics.tileWidth,
  };
}

/**
 * Depth key for a foot position. It is the screen Y of that point.
 * Larger values are closer to the camera and draw in front.
 */
export function footDepth(x: number, y: number, tileHeight: number): number {
  return (x + y) * (tileHeight / 2);
}
