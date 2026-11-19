export interface IsoMetrics {
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
}

/** Fixed-angle isometric projection. Origin keeps the grid inside positive coordinates. */
export function isoProject(x: number, y: number, metrics: IsoMetrics): { x: number; y: number } {
  const originX = (metrics.columns * metrics.tileWidth) / 2;
  return {
    x: originX + (x - y) * (metrics.tileWidth / 2),
    y: (x + y) * (metrics.tileHeight / 2),
  };
}

export function isoMapSize(metrics: IsoMetrics): { width: number; height: number } {
  return {
    width: metrics.columns * metrics.tileWidth,
    height: metrics.rows * metrics.tileHeight,
  };
}
