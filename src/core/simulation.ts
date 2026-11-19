import { SeededRng } from './rng.ts';

const ATTACK_STYLES = ['melee', 'magic', 'ranged'] as const;

export type AttackStyle = (typeof ATTACK_STYLES)[number];

export type Command =
  | { type: 'move'; x: number; y: number }
  | { type: 'attack'; style: AttackStyle }
  | { type: 'use-item'; itemId: string };

export interface WorldState {
  tick: number;
  player: { x: number; y: number };
  lastAttack: { style: AttackStyle; tick: number } | null;
  lastItemUse: { itemId: string; tick: number } | null;
}

export interface SimulationOptions {
  seed: number;
  moveSpeedPerTick: number;
  spawn: { x: number; y: number };
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Authoritative world for one client. Callers enqueue commands; only tick()
 * changes state. Phaser reads snapshots and interpolates between them.
 */
export class Simulation {
  private readonly rng: SeededRng;
  private readonly moveSpeedPerTick: number;
  private readonly bounds: SimulationOptions['bounds'];
  private state: WorldState;
  private previous: WorldState;
  private pendingMove: { x: number; y: number } | null = null;
  private queue: Exclude<Command, { type: 'move' }>[] = [];

  constructor(options: SimulationOptions) {
    this.rng = new SeededRng(options.seed);
    this.moveSpeedPerTick = options.moveSpeedPerTick;
    this.bounds = options.bounds;
    this.state = {
      tick: 0,
      player: { x: options.spawn.x, y: options.spawn.y },
      lastAttack: null,
      lastItemUse: null,
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
    if (command.itemId.trim() === '') throw new Error('item id is required');
    this.queue.push({ type: 'use-item', itemId: command.itemId.trim() });
  }

  tick(): void {
    this.previous = structuredClone(this.state);
    const move = this.pendingMove;
    this.pendingMove = null;
    if (move) this.applyMove(move);
    const resolvedTick = this.state.tick + 1;
    for (const command of this.queue) {
      if (command.type === 'attack') {
        this.state.lastAttack = { style: command.style, tick: resolvedTick };
      } else {
        this.state.lastItemUse = { itemId: command.itemId, tick: resolvedTick };
      }
    }
    this.queue = [];
    this.state.tick = resolvedTick;
  }

  getState(): WorldState {
    return structuredClone(this.state);
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
    let x = this.state.player.x + move.x * scale;
    let y = this.state.player.y + move.y * scale;
    const bounds = this.bounds;
    if (bounds) {
      x = Math.min(bounds.maxX, Math.max(bounds.minX, x));
      y = Math.min(bounds.maxY, Math.max(bounds.minY, y));
    }
    this.state.player = { x, y };
  }
}

function isAttackStyle(style: string): style is AttackStyle {
  return (ATTACK_STYLES as readonly string[]).includes(style);
}
