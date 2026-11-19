import { describe, expect, it } from 'vitest';
import { footDepth, isoMapSize, isoProject, pixelToTile } from './iso.ts';

const metrics = { tileWidth: 80, tileHeight: 40, columns: 4, rows: 4 };

describe('iso projection', () => {
  it('places world points on a fixed isometric diamond grid', () => {
    expect(isoProject(0, 0, metrics)).toEqual({ x: 160, y: 0 });
    expect(isoProject(1, 0, metrics)).toEqual({ x: 200, y: 20 });
    expect(isoProject(0, 1, metrics)).toEqual({ x: 120, y: 20 });
    expect(isoProject(1, 1, metrics)).toEqual({ x: 160, y: 40 });
  });

  it('reports a map size that contains the grid', () => {
    expect(isoMapSize(metrics)).toEqual({ width: 320, height: 160 });
    expect(isoMapSize({ ...metrics, columns: 6, rows: 2 })).toEqual({ width: 320, height: 160 });
  });

  it('round-trips a tile point through Tiled pixel space', () => {
    const wide = { tileWidth: 64, tileHeight: 32, columns: 10, rows: 4 };
    expect(pixelToTile(isoProject(2.5, 1.25, wide).x, isoProject(2.5, 1.25, wide).y, wide)).toEqual(
      {
        x: 2.5,
        y: 1.25,
      },
    );
  });

  it('sorts a foot north of a prop behind it and a foot south in front', () => {
    const propBase = footDepth(6, 6, 32);
    expect(footDepth(4.5, 4.5, 32)).toBeLessThan(propBase);
    expect(footDepth(6.4, 6.4, 32)).toBeGreaterThan(propBase);
    expect(footDepth(1, 1, metrics.tileHeight)).toBe(isoProject(1, 1, metrics).y);
  });
});
