import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation.ts';
import { circleHitsAny, circleHitsShape } from './collision.ts';
import { parseTiledMap, parseTileset } from './tiled.ts';
import type { Shape, Vec, ZoneMap, ZoneTrigger } from './types.ts';

const RADIUS = 0.28;
const SPEED = 0.15;

function loadMaps(): {
  maps: ZoneMap[];
  tilesetImages: { image: string; width: number; height: number }[];
} {
  const tilesetJson = JSON.parse(readFileSync('content/maps/journey-iso.tsj', 'utf8')) as unknown;
  const tileset = parseTileset(tilesetJson);
  const maps = ['town', 'overworld', 'dungeon'].map((name) => {
    const json = JSON.parse(readFileSync(`content/maps/${name}.tmj`, 'utf8')) as unknown;
    return parseTiledMap(json, { 'journey-iso.tsj': tilesetJson });
  });
  return {
    maps,
    tilesetImages: tileset.tiles.map((tile) => ({
      image: tile.image,
      width: tile.imageWidth,
      height: tile.imageHeight,
    })),
  };
}

function simulation(maps: readonly ZoneMap[], zoneId: string, spawnId: string): Simulation {
  return new Simulation({
    seed: 1,
    moveSpeedPerTick: SPEED,
    spawn: { x: 0, y: 0 },
    zones: maps,
    startingZone: zoneId,
    startingSpawn: spawnId,
    bodyRadius: RADIUS,
    transitionLockTicks: 15,
  });
}

function hits(point: Vec, shapes: readonly Shape[]): boolean {
  return (
    circleHitsAny(point, RADIUS, shapes) ||
    point.x < RADIUS ||
    point.y < RADIUS ||
    point.x > 10_000 ||
    point.y > 10_000
  );
}

function insideMap(point: Vec, map: ZoneMap): boolean {
  return (
    point.x >= RADIUS &&
    point.y >= RADIUS &&
    point.x <= map.width - RADIUS &&
    point.y <= map.height - RADIUS
  );
}

function tileOpen(map: ZoneMap, column: number, row: number): boolean {
  if (column < 0 || row < 0 || column >= map.width || row >= map.height) return false;
  const center = { x: column + 0.5, y: row + 0.5 };
  return insideMap(center, map) && !circleHitsAny(center, RADIUS, map.blockers);
}

function pathBetween(map: ZoneMap, from: Vec, to: Vec): Vec[] | null {
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  const key = (x: number, y: number) => `${x},${y}`;
  const previous = new Map<string, string | null>();
  const queue = [start];
  previous.set(key(start.x, start.y), null);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) break;
    if (current.x === goal.x && current.y === goal.y) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      const id = key(next.x, next.y);
      if (previous.has(id) || !tileOpen(map, next.x, next.y)) continue;
      previous.set(id, key(current.x, current.y));
      queue.push(next);
    }
  }
  const goalKey = key(goal.x, goal.y);
  if (!previous.has(goalKey)) return null;
  const points: Vec[] = [];
  let cursor: string | null = goalKey;
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    points.push({ x: (x ?? 0) + 0.5, y: (y ?? 0) + 0.5 });
    cursor = previous.get(cursor) ?? null;
  }
  points.reverse();
  return points;
}

function triggerPoint(map: ZoneMap, trigger: ZoneTrigger): Vec {
  for (let row = 0; row < map.height; row += 1) {
    for (let column = 0; column < map.width; column += 1) {
      const center = { x: column + 0.5, y: row + 0.5 };
      if (tileOpen(map, column, row) && circleHitsShape(center, 0.05, trigger.shape)) return center;
    }
  }
  throw new Error(`${map.id} trigger ${trigger.id} has no open tile`);
}

function walkToZone(
  sim: Simulation,
  map: ZoneMap,
  trigger: ZoneTrigger,
  destination: string,
): void {
  const goal = triggerPoint(map, trigger);
  const route = pathBetween(map, sim.getState().player, goal);
  expect(route, `${map.id} route to ${trigger.id}`).not.toBeNull();
  if (!route) return;
  let step = 0;
  let stuck = 0;
  let previous = sim.getState().player;
  for (let tick = 0; tick < 6000; tick += 1) {
    if (sim.getState().zoneId === destination) return;
    const target = route[Math.min(step, route.length - 1)];
    if (!target) break;
    const position = sim.getState().player;
    if (Math.hypot(target.x - position.x, target.y - position.y) < 0.45) step += 1;
    sim.enqueue({ type: 'move', x: target.x - position.x, y: target.y - position.y });
    sim.tick();
    if (sim.getState().zoneId === destination) return;
    const next = sim.getState().player;
    if (Math.hypot(next.x - previous.x, next.y - previous.y) < 0.0001) stuck += 1;
    else stuck = 0;
    previous = next;
    if (stuck > 45) {
      throw new Error(
        `stuck in ${sim.getState().zoneId} at ${next.x.toFixed(2)},${next.y.toFixed(2)} going to ${trigger.id}`,
      );
    }
  }
  throw new Error(`did not enter ${destination} from ${map.id}`);
}

describe('shipped isometric maps', () => {
  const { maps, tilesetImages } = loadMaps();
  const byId = new Map(maps.map((map) => [map.id, map]));

  it('ships a tileset whose images exist and match the declared size', () => {
    expect(tilesetImages.length).toBeGreaterThan(0);
    for (const tile of tilesetImages) {
      const file = path.join('content/maps', tile.image);
      expect(existsSync(file), tile.image).toBe(true);
      const header = readFileSync(file);
      expect(header.readUInt32BE(16)).toBe(tile.width);
      expect(header.readUInt32BE(20)).toBe(tile.height);
    }
    expect(existsSync('content/maps/tiles/hero.png')).toBe(true);
  });

  it('places the quest giver, the dungeon mouth, and four monster camps', () => {
    const town = byId.get('town');
    const overworld = byId.get('overworld');
    const dungeon = byId.get('dungeon');
    expect(town?.markers.map((marker) => marker.kind)).toContain('quest-npc');
    expect(overworld?.markers.map((marker) => marker.kind)).toContain('dungeon-entrance');
    const camps = overworld?.markers.filter((marker) => marker.kind === 'monster-spawn') ?? [];
    expect(camps.map((camp) => camp.properties.monster).sort()).toEqual([
      'bandit',
      'boar',
      'slime',
      'wolf',
    ]);
    expect(
      dungeon?.markers.find((marker) => marker.kind === 'sealed-door')?.properties.continuesIn,
    ).toBe('M5');
    const raw = JSON.parse(readFileSync('content/maps/dungeon.tmj', 'utf8')) as {
      properties: { name: string; value: string }[];
    };
    expect(raw.properties.find((property) => property.name === 'status')?.value).toBe('stub');
  });

  it('keeps every spawn on open ground and outside same-map triggers', () => {
    for (const map of maps) {
      expect(map.spawns.length).toBeGreaterThan(0);
      for (const spawn of map.spawns) {
        const point = { x: spawn.x, y: spawn.y };
        expect(insideMap(point, map), `${map.id}:${spawn.id} outside`).toBe(true);
        expect(hits(point, map.blockers), `${map.id}:${spawn.id} blocked`).toBe(false);
        for (const trigger of map.triggers) {
          expect(circleHitsShape(point, RADIUS, trigger.shape), `${map.id}:${spawn.id}`).toBe(
            false,
          );
        }
      }
    }
  });

  it('walks from town through the overworld and into the dungeon stub', () => {
    const sim = simulation(maps, 'town', 'default');
    const town = byId.get('town');
    const overworld = byId.get('overworld');
    const dungeon = byId.get('dungeon');
    if (!town || !overworld || !dungeon) throw new Error('missing zone');
    const leaveTown = town.triggers.find((trigger) => trigger.targetZone === 'overworld');
    const enterDungeon = overworld.triggers.find((trigger) => trigger.targetZone === 'dungeon');
    const leaveDungeon = dungeon.triggers.find((trigger) => trigger.targetZone === 'overworld');
    if (!leaveTown || !enterDungeon || !leaveDungeon) throw new Error('missing trigger');
    walkToZone(sim, town, leaveTown, 'overworld');
    expect(sim.getState().zoneId).toBe('overworld');
    expect(sim.getState().player).toMatchObject({
      x: expect.closeTo(5.5, 1),
      y: expect.any(Number),
    });
    walkToZone(sim, overworld, enterDungeon, 'dungeon');
    expect(sim.getState().zoneId).toBe('dungeon');
    walkToZone(sim, dungeon, leaveDungeon, 'overworld');
    expect(sim.getState().zoneId).toBe('overworld');
    expect(circleHitsAny(sim.getState().player, RADIUS, overworld.blockers)).toBe(false);
  });
});
