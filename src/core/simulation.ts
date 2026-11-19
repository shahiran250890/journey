import { circleHitsShape, resolveCircleMove } from './world/collision.ts';
import type { SpawnPoint, Vec, ZoneMap } from './world/types.ts';
import { SeededRng } from './rng.ts';

const ATTACK_STYLES = ['melee', 'magic', 'ranged'] as const;

export type AttackStyle = (typeof ATTACK_STYLES)[number];

export type Command =
  | { type: 'move'; x: number; y: number }
  | { type: 'attack'; style: AttackStyle }
  | { type: 'use-item'; itemId: string }
  | { type: 'teleport'; zoneId: string; spawnId: string }
  | { type: 'teleport'; zoneId: string; x: number; y: number };

export interface ZoneTransition {
  fromZone: string;
  toZone: string;
  spawnId: string;
  tick: number;
}

export interface WorldState {
  tick: number;
  zoneId: string;
  player: { x: number; y: number };
  lastAttack: { style: AttackStyle; tick: number } | null;
  lastItemUse: { itemId: string; tick: number } | null;
  lastTransition: ZoneTransition | null;
}

export interface SimulationOptions {
  seed: number;
  moveSpeedPerTick: number;
  spawn: { x: number; y: number };
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  zones?: readonly ZoneMap[];
  startingZone?: string;
  startingSpawn?: string;
  bodyRadius?: number;
  transitionLockTicks?: number;
}

type Queued = Exclude<Command, { type: 'move' }>;

/**
 * Authoritative world for one client. Callers enqueue commands; only tick()
 * changes state. Phaser reads snapshots and interpolates between them.
 * Movement is normalized, then resolved against the current zone's blockers.
 */
export class Simulation {
  private readonly rng: SeededRng;
  private readonly moveSpeedPerTick: number;
  private readonly bounds: SimulationOptions['bounds'];
  private readonly bodyRadius: number;
  private readonly transitionLockTicks: number;
  private readonly zoneMaps = new Map<string, ZoneMap>();
  private state: WorldState;
  private previous: WorldState;
  private pendingMove: { x: number; y: number } | null = null;
  private queue: Queued[] = [];
  private transitionLock = 0;
  private snapInterpolation = false;

  constructor(options: SimulationOptions) {
    this.rng = new SeededRng(options.seed);
    this.moveSpeedPerTick = options.moveSpeedPerTick;
    this.bounds = options.bounds;
    this.bodyRadius = options.bodyRadius ?? 0;
    this.transitionLockTicks = options.transitionLockTicks ?? 15;
    let zoneId = 'default';
    let player = { x: options.spawn.x, y: options.spawn.y };
    if (options.zones) {
      for (const zone of options.zones) {
        if (this.zoneMaps.has(zone.id)) throw new Error(`duplicate zone ${zone.id}`);
        this.zoneMaps.set(zone.id, zone);
      }
      zoneId = options.startingZone ?? options.zones[0]?.id ?? zoneId;
      if (!this.zoneMaps.has(zoneId)) throw new Error(`unknown zone ${zoneId}`);
      if (options.startingSpawn) {
        player = this.spawnPoint(zoneId, options.startingSpawn);
      }
    }
    this.state = {
      tick: 0,
      zoneId,
      player,
      lastAttack: null,
      lastItemUse: null,
      lastTransition: null,
    };
    this.previous = structuredClone(this.state);
  }

  enqueue(command: Command): void {
    if (command.type === 'move') {
      if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) {
        throw new Error('move must be finite');
      }
      this.pendingMove = { x: command.x, y: command.y };
      return;
    }
    if (command.type === 'attack') {
      if (!isAttackStyle(command.style)) throw new Error('unknown attack style');
      this.queue.push({ type: 'attack', style: command.style });
      return;
    }
    if (command.type === 'teleport') {
      this.queue.push(this.validTeleport(command));
      return;
    }
    if (command.itemId.trim() === '') throw new Error('item id is required');
    this.queue.push({ type: 'use-item', itemId: command.itemId.trim() });
  }

  tick(): void {
    this.previous = structuredClone(this.state);
    if (this.transitionLock > 0) this.transitionLock -= 1;
    const move = this.pendingMove;
    this.pendingMove = null;
    if (move) this.applyMove(move);
    const resolvedTick = this.state.tick + 1;
    for (const command of this.queue) {
      if (command.type === 'attack') {
        this.state.lastAttack = { style: command.style, tick: resolvedTick };
      } else if (command.type === 'use-item') {
        this.state.lastItemUse = { itemId: command.itemId, tick: resolvedTick };
      } else {
        this.applyTeleport(command);
      }
    }
    this.queue = [];
    this.state.tick = resolvedTick;
    if (this.zoneMaps.size > 0) this.refreshZone(resolvedTick);
    if (this.snapInterpolation) {
      this.previous = structuredClone(this.state);
      this.snapInterpolation = false;
    }
  }

  getState(): WorldState {
    return structuredClone(this.state);
  }

  getMap(zoneId: string): ZoneMap {
    const zone = this.zoneMaps.get(zoneId);
    if (!zone) throw new Error(`unknown zone ${zoneId}`);
    return zone;
  }

  getRngState(): number {
    return this.rng.getState();
  }

  /** alpha 0 is the previous tick; alpha 1 is the current tick. */
  interpolatePlayer(alpha: number): { x: number; y: number } {
    const t = Math.min(1, Math.max(0, alpha));
    return {
      x: this.previous.player.x + (this.state.player.x - this.previous.player.x) * t,
      y: this.previous.player.y + (this.state.player.y - this.previous.player.y) * t,
    };
  }

  private applyMove(move: { x: number; y: number }): void {
    const length = Math.hypot(move.x, move.y);
    if (length === 0) return;
    const scale = this.moveSpeedPerTick / length;
    const delta = { x: move.x * scale, y: move.y * scale };
    const zone = this.zoneMaps.get(this.state.zoneId);
    if (!zone) {
      let x = this.state.player.x + delta.x;
      let y = this.state.player.y + delta.y;
      const bounds = this.bounds;
      if (bounds) {
        x = Math.min(bounds.maxX, Math.max(bounds.minX, x));
        y = Math.min(bounds.maxY, Math.max(bounds.minY, y));
      }
      this.state.player = { x, y };
      return;
    }
    this.state.player = resolveCircleMove(
      this.state.player,
      delta,
      this.bodyRadius,
      zone.blockers,
      { minX: 0, minY: 0, maxX: zone.width, maxY: zone.height },
    );
  }

  private refreshZone(tick: number): void {
    if (this.transitionLock > 0) return;
    const zone = this.zoneMaps.get(this.state.zoneId);
    if (!zone) return;
    for (const trigger of zone.triggers) {
      if (circleHitsShape(this.state.player, this.bodyRadius, trigger.shape)) {
        this.enterZone(trigger.targetZone, trigger.targetSpawn, tick);
        return;
      }
    }
  }

  private applyTeleport(command: Extract<Command, { type: 'teleport' }>): void {
    if ('spawnId' in command) {
      this.enterZone(command.zoneId, command.spawnId, this.state.tick + 1);
      return;
    }
    const zone = this.zoneMaps.get(command.zoneId);
    if (!zone) throw new Error(`unknown zone ${command.zoneId}`);
    const fromZone = this.state.zoneId;
    this.state.zoneId = command.zoneId;
    this.state.player = clampToMap({ x: command.x, y: command.y }, zone, this.bodyRadius);
    this.transitionLock = this.transitionLockTicks;
    this.snapInterpolation = true;
    if (fromZone !== command.zoneId) {
      this.state.lastTransition = {
        fromZone,
        toZone: command.zoneId,
        spawnId: '',
        tick: this.state.tick + 1,
      };
    }
  }

  private enterZone(zoneId: string, spawnId: string, tick: number): void {
    const fromZone = this.state.zoneId;
    const point = this.spawnPoint(zoneId, spawnId);
    this.state.zoneId = zoneId;
    this.state.player = { x: point.x, y: point.y };
    this.transitionLock = this.transitionLockTicks;
    this.snapInterpolation = true;
    this.state.lastTransition = { fromZone, toZone: zoneId, spawnId, tick };
  }

  private spawnPoint(zoneId: string, spawnId: string): SpawnPoint {
    const zone = this.zoneMaps.get(zoneId);
    if (!zone) throw new Error(`unknown zone ${zoneId}`);
    const spawn = zone.spawns.find((candidate) => candidate.id === spawnId);
    if (!spawn) throw new Error(`unknown spawn ${spawnId} in ${zoneId}`);
    return spawn;
  }

  private validTeleport(command: Extract<Command, { type: 'teleport' }>): Queued {
    if (!this.zoneMaps.has(command.zoneId)) throw new Error(`unknown zone ${command.zoneId}`);
    if ('spawnId' in command) {
      this.spawnPoint(command.zoneId, command.spawnId);
      return { type: 'teleport', zoneId: command.zoneId, spawnId: command.spawnId };
    }
    if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) {
      throw new Error('teleport must be finite');
    }
    return { type: 'teleport', zoneId: command.zoneId, x: command.x, y: command.y };
  }
}

function clampToMap(point: Vec, zone: ZoneMap, radius: number): Vec {
  const minX = radius;
  const minY = radius;
  const maxX = Math.max(radius, zone.width - radius);
  const maxY = Math.max(radius, zone.height - radius);
  return {
    x: Math.min(maxX, Math.max(minX, point.x)),
    y: Math.min(maxY, Math.max(minY, point.y)),
  };
}

function isAttackStyle(style: string): style is AttackStyle {
  return (ATTACK_STYLES as readonly string[]).includes(style);
}
