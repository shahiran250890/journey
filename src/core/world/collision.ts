import type { Aabb, Shape, Vec } from './types.ts';

const SKIN = 1e-6;

/** True when a circle overlaps a tile rectangle, circle, or polygon. */
export function circleHitsShape(center: Vec, radius: number, shape: Shape): boolean {
  if (shape.kind === 'aabb') return hitsAabb(center, radius, shape);
  if (shape.kind === 'circle') {
    const reach = radius + shape.radius;
    return distanceSquared(center, shape) < reach * reach - SKIN;
  }
  return hitsPolygon(center, radius, shape.points);
}

export function circleHitsAny(center: Vec, radius: number, shapes: readonly Shape[]): boolean {
  return shapes.some((shape) => circleHitsShape(center, radius, shape));
}

/**
 * Move a circle by delta. Bounds are the outer rectangle the body must stay
 * inside, so the center is kept one radius in from the edge. A blocked slide
 * keeps the free axis. A circle that starts overlapping can still step toward
 * open ground.
 */
export function resolveCircleMove(
  position: Vec,
  delta: Vec,
  radius: number,
  shapes: readonly Shape[],
  bounds?: Aabb,
): Vec {
  if (radius < 0) throw new Error('radius must not be negative');
  if (delta.x === 0 && delta.y === 0) return { x: position.x, y: position.y };
  const limits = bounds ? inset(bounds, radius) : undefined;
  if (free(position, radius, shapes, limits)) return slide(position, delta, radius, shapes, limits);
  return escape(position, delta, radius, shapes, limits);
}

/** Screen-space outline of a shape, in the same tile coordinates as the shape. */
export function shapeOutline(shape: Shape): Vec[] {
  if (shape.kind === 'aabb') {
    return [
      { x: shape.minX, y: shape.minY },
      { x: shape.maxX, y: shape.minY },
      { x: shape.maxX, y: shape.maxY },
      { x: shape.minX, y: shape.maxY },
    ];
  }
  if (shape.kind === 'circle') {
    const points: Vec[] = [];
    const steps = 16;
    for (let index = 0; index < steps; index += 1) {
      const angle = (index / steps) * Math.PI * 2;
      points.push({
        x: shape.x + Math.cos(angle) * shape.radius,
        y: shape.y + Math.sin(angle) * shape.radius,
      });
    }
    return points;
  }
  return shape.points.map((point) => ({ x: point.x, y: point.y }));
}

function slide(
  position: Vec,
  delta: Vec,
  radius: number,
  shapes: readonly Shape[],
  limits: Aabb | undefined,
): Vec {
  const moved = approach(position, delta, radius, shapes, limits);
  const remainX = delta.x - (moved.x - position.x);
  const remainY = delta.y - (moved.y - position.y);
  const alongX = approach(moved, { x: remainX, y: 0 }, radius, shapes, limits);
  return approach(alongX, { x: 0, y: remainY }, radius, shapes, limits);
}

/** Walk as far along delta as the circle can go without overlapping. */
function approach(
  position: Vec,
  delta: Vec,
  radius: number,
  shapes: readonly Shape[],
  limits: Aabb | undefined,
): Vec {
  if (delta.x === 0 && delta.y === 0) return position;
  if (free(add(position, delta), radius, shapes, limits)) return add(position, delta);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 12; step += 1) {
    const mid = (low + high) / 2;
    const candidate = add(position, { x: delta.x * mid, y: delta.y * mid });
    if (free(candidate, radius, shapes, limits)) low = mid;
    else high = mid;
  }
  if (low === 0) return position;
  return add(position, { x: delta.x * low, y: delta.y * low });
}

function escape(
  position: Vec,
  delta: Vec,
  radius: number,
  shapes: readonly Shape[],
  limits: Aabb | undefined,
): Vec {
  const nudge = Math.max(Math.hypot(delta.x, delta.y), 0.05);
  const candidates = [
    add(position, delta),
    { x: position.x + delta.x, y: position.y },
    { x: position.x, y: position.y + delta.y },
  ];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    candidates.push({
      x: position.x + Math.cos(angle) * nudge,
      y: position.y + Math.sin(angle) * nudge,
    });
  }
  let best = position;
  let bestScore = penetration(position, radius, shapes, limits);
  for (const candidate of candidates) {
    const score = penetration(candidate, radius, shapes, limits);
    if (score < bestScore - 1e-6) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function free(
  point: Vec,
  radius: number,
  shapes: readonly Shape[],
  limits: Aabb | undefined,
): boolean {
  if (limits && !inside(point, limits)) return false;
  return !circleHitsAny(point, radius, shapes);
}

function penetration(
  point: Vec,
  radius: number,
  shapes: readonly Shape[],
  limits: Aabb | undefined,
): number {
  let score = 0;
  if (limits && !inside(point, limits)) {
    const dx = Math.max(limits.minX - point.x, 0, point.x - limits.maxX);
    const dy = Math.max(limits.minY - point.y, 0, point.y - limits.maxY);
    score += Math.hypot(dx, dy) + radius;
  }
  for (const shape of shapes) score += shapePenetration(point, radius, shape);
  return score;
}

function shapePenetration(center: Vec, radius: number, shape: Shape): number {
  if (shape.kind === 'aabb') return aabbPenetration(center, radius, shape);
  if (shape.kind === 'circle') {
    const dist = Math.hypot(center.x - shape.x, center.y - shape.y);
    return Math.max(0, shape.radius + radius - dist);
  }
  if (!hitsPolygon(center, radius, shape.points)) return 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < shape.points.length; index += 1) {
    const start = shape.points[index];
    const end = shape.points[(index + 1) % shape.points.length];
    if (!start || !end) continue;
    nearest = Math.min(nearest, Math.sqrt(distanceToSegmentSquared(center, start, end)));
  }
  if (pointInPolygon(center, shape.points)) return radius + nearest;
  return Math.max(0, radius - nearest);
}

function aabbPenetration(center: Vec, radius: number, box: Aabb): number {
  const closestX = clamp(center.x, box.minX, box.maxX);
  const closestY = clamp(center.y, box.minY, box.maxY);
  const dist = Math.hypot(center.x - closestX, center.y - closestY);
  if (dist > 0) return Math.max(0, radius - dist);
  const toEdge = Math.min(
    center.x - box.minX,
    box.maxX - center.x,
    center.y - box.minY,
    box.maxY - center.y,
  );
  return radius + toEdge;
}

function hitsAabb(center: Vec, radius: number, box: Aabb): boolean {
  const x = clamp(center.x, box.minX, box.maxX);
  const y = clamp(center.y, box.minY, box.maxY);
  return distanceSquared(center, { x, y }) < radius * radius - SKIN;
}

function hitsPolygon(center: Vec, radius: number, points: readonly Vec[]): boolean {
  if (points.length < 3) return false;
  if (pointInPolygon(center, points)) return true;
  const limit = radius * radius - SKIN;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!start || !end) continue;
    if (distanceToSegmentSquared(center, start, end) < limit) return true;
  }
  return false;
}

function pointInPolygon(point: Vec, points: readonly Vec[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index];
    const prior = points[previous];
    if (!current || !prior) continue;
    const crosses =
      current.y > point.y !== prior.y > point.y &&
      point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegmentSquared(point: Vec, start: Vec, end: Vec): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distanceSquared(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distanceSquared(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function distanceSquared(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function inset(bounds: Aabb, radius: number): Aabb {
  const limits = {
    minX: bounds.minX + radius,
    minY: bounds.minY + radius,
    maxX: bounds.maxX - radius,
    maxY: bounds.maxY - radius,
  };
  if (limits.maxX < limits.minX || limits.maxY < limits.minY) {
    throw new Error('bounds are smaller than the moving body');
  }
  return limits;
}

function inside(point: Vec, limits: Aabb): boolean {
  return (
    point.x >= limits.minX &&
    point.y >= limits.minY &&
    point.x <= limits.maxX &&
    point.y <= limits.maxY
  );
}

function add(position: Vec, delta: Vec): Vec {
  return { x: position.x + delta.x, y: position.y + delta.y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
