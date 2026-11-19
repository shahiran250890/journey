import { describe, expect, it } from 'vitest';
import { isoMapSize, isoProject } from './iso.ts';

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
  });
});
