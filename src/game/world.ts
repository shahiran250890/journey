import dungeon from '../../content/maps/dungeon.tmj';
import overworld from '../../content/maps/overworld.tmj';
import tileset from '../../content/maps/journey-iso.tsj';
import town from '../../content/maps/town.tmj';
import type { ContentBundle } from '../core/content/load.ts';
import { Simulation } from '../core/simulation.ts';
import { parseTiledMap } from '../core/world/tiled.ts';

export function createJourneySimulation(content: ContentBundle, seed: number): Simulation {
  const external = { 'journey-iso.tsj': tileset as Record<string, unknown> };
  const maps = [town, overworld, dungeon].map((map) => parseTiledMap(map, external));
  return new Simulation({
    seed,
    moveSpeedPerTick: content.world.moveSpeedPerTick,
    spawn: { x: 0, y: 0 },
    zones: maps,
    startingZone: 'town',
    startingSpawn: 'default',
    bodyRadius: content.world.playerRadius,
    transitionLockTicks: content.world.transitionLockTicks,
  });
}
