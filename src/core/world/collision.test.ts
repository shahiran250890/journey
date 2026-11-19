import { describe, expect, it } from 'vitest';
import { circleHitsShape, resolveCircleMove } from './collision.ts';
import type { Shape } from './types.ts';

const wall: Shape = { kind: 'aabb', minX: 2, minY: 0, maxX: 3, maxY: 6 };

describe('circle collision', () => {
  it('hits a tile the circle overlaps and misses a tile it only touches from outside', () => {
    expect(circleHitsShape({ x: 1.8, y: 1 }, 0.3, wall)).toBe(true);
    expect(circleHitsShape({ x: 1.6, y: 1 }, 0.3, wall)).toBe(false);
  });

  it('hits a circle and a polygon', () => {
    const boulder: Shape = { kind: 'circle', x: 4, y: 4, radius: 0.8 };
    expect(circleHitsShape({ x: 5, y: 4 }, 0.3, boulder)).toBe(true);
    expect(circleHitsShape({ x: 5.2, y: 4 }, 0.3, boulder)).toBe(false);
    const diamond: Shape = {
      kind: 'polygon',
      points: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: -1, y: 0 },
      ],
    };
    expect(circleHitsShape({ x: 0, y: 0 }, 0.2, diamond)).toBe(true);
    expect(circleHitsShape({ x: 1.4, y: 0 }, 0.2, diamond)).toBe(false);
    expect(circleHitsShape({ x: 1.1, y: 0 }, 0.2, diamond)).toBe(true);
  });

  it('stops at a blocking tile and does not enter it', () => {
    let position = { x: 1, y: 1 };
    for (let step = 0; step < 40; step += 1) {
      position = resolveCircleMove(position, { x: 0.2, y: 0 }, 0.3, [wall]);
    }
    expect(position.x).toBeLessThan(2 - 0.3 + 1e-6);
    expect(position.y).toBeCloseTo(1);
    expect(circleHitsShape(position, 0.3, wall)).toBe(false);
  });

  it('slides along a wall when the move is diagonal', () => {
    const longWall: Shape = { kind: 'aabb', minX: 2, minY: -10, maxX: 3, maxY: 10 };
    let position = { x: 1, y: 0 };
    for (let step = 0; step < 24; step += 1) {
      position = resolveCircleMove(position, { x: 0.15, y: 0.15 }, 0.25, [longWall]);
    }
    expect(position.x).toBeLessThan(2 - 0.25 + 1e-6);
    expect(position.y).toBeGreaterThan(2);
    expect(circleHitsShape(position, 0.25, longWall)).toBe(false);
  });

  it('walks through a one-tile gap between blockers', () => {
    const left: Shape = { kind: 'aabb', minX: 0, minY: 2, maxX: 2, maxY: 3 };
    const right: Shape = { kind: 'aabb', minX: 3, minY: 2, maxX: 5, maxY: 3 };
    let position = { x: 2.5, y: 0.5 };
    for (let step = 0; step < 40; step += 1) {
      position = resolveCircleMove(position, { x: 0, y: 0.2 }, 0.28, [left, right]);
    }
    expect(position.y).toBeGreaterThan(4);
    expect(position.x).toBeCloseTo(2.5);
  });

  it('keeps the body inside the map bounds', () => {
    const position = resolveCircleMove({ x: 0.4, y: 1 }, { x: -1, y: 0 }, 0.3, [], {
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
    });
    expect(position.x).toBeCloseTo(0.3);
    expect(position.y).toBeCloseTo(1);
  });

  it('can leave a tile it was placed inside', () => {
    const start = { x: 2.5, y: 1 };
    expect(circleHitsShape(start, 0.3, wall)).toBe(true);
    let position = start;
    for (let step = 0; step < 20; step += 1) {
      position = resolveCircleMove(position, { x: -0.2, y: 0 }, 0.3, [wall]);
    }
    expect(circleHitsShape(position, 0.3, wall)).toBe(false);
    expect(position.x).toBeLessThan(2);
  });
});
