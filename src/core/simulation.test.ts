import { describe, expect, it } from 'vitest';
import { FixedTickClock } from './clock.ts';
import { Simulation } from './simulation.ts';

const options = {
  seed: 1,
  moveSpeedPerTick: 1,
  spawn: { x: 0, y: 0 },
};

describe('Simulation', () => {
  it('does not apply a move command until the next tick', () => {
    const sim = new Simulation(options);
    sim.enqueue({ type: 'move', x: 1, y: 0 });
    expect(sim.getState().player).toEqual({ x: 0, y: 0 });
    expect(sim.getState().tick).toBe(0);
    sim.tick();
    expect(sim.getState().player).toEqual({ x: 1, y: 0 });
    expect(sim.getState().tick).toBe(1);
  });

  it('keeps only the latest move command for the next tick', () => {
    const sim = new Simulation(options);
    sim.enqueue({ type: 'move', x: 1, y: 0 });
    sim.enqueue({ type: 'move', x: 0, y: 1 });
    sim.tick();
    expect(sim.getState().player).toEqual({ x: 0, y: 1 });
  });

  it('does not keep moving on later ticks without a new command', () => {
    const sim = new Simulation(options);
    sim.enqueue({ type: 'move', x: 1, y: 0 });
    sim.tick();
    sim.tick();
    expect(sim.getState().player).toEqual({ x: 1, y: 0 });
    expect(sim.getState().tick).toBe(2);
  });

  it('normalizes a move vector longer than one unit', () => {
    const sim = new Simulation({ ...options, moveSpeedPerTick: 2 });
    sim.enqueue({ type: 'move', x: 3, y: 0 });
    sim.tick();
    expect(sim.getState().player.x).toBeCloseTo(2);
    expect(sim.getState().player.y).toBeCloseTo(0);
  });

  it('normalizes a diagonal move', () => {
    const sim = new Simulation(options);
    sim.enqueue({ type: 'move', x: 1, y: 1 });
    sim.tick();
    expect(sim.getState().player.x).toBeCloseTo(Math.SQRT1_2);
    expect(sim.getState().player.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('clamps movement to the configured bounds', () => {
    const sim = new Simulation({
      seed: 1,
      moveSpeedPerTick: 5,
      spawn: { x: 1, y: 1 },
      bounds: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
    });
    sim.enqueue({ type: 'move', x: -1, y: -1 });
    sim.tick();
    expect(sim.getState().player).toEqual({ x: 0, y: 0 });
  });

  it('applies attack and use-item commands on the tick without moving the player', () => {
    const sim = new Simulation({ ...options, spawn: { x: 1, y: 1 } });
    sim.enqueue({ type: 'attack', style: 'magic' });
    sim.enqueue({ type: 'use-item', itemId: 'class-change' });
    sim.tick();
    const state = sim.getState();
    expect(state.player).toEqual({ x: 1, y: 1 });
    expect(state.lastAttack).toEqual({ style: 'magic', tick: 1 });
    expect(state.lastItemUse).toEqual({ itemId: 'class-change', tick: 1 });
  });

  it('returns copies so callers cannot mutate simulation state', () => {
    const sim = new Simulation(options);
    const state = sim.getState();
    state.player.x = 99;
    state.tick = 50;
    expect(sim.getState().player.x).toBe(0);
    expect(sim.getState().tick).toBe(0);
  });

  it('interpolates from the previous tick toward the current one', () => {
    const sim = new Simulation({ ...options, moveSpeedPerTick: 4 });
    sim.enqueue({ type: 'move', x: 1, y: 0 });
    sim.tick();
    expect(sim.interpolatePlayer(0).x).toBeCloseTo(0);
    expect(sim.interpolatePlayer(1).x).toBeCloseTo(4);
    expect(sim.interpolatePlayer(0.5).x).toBeCloseTo(2);
  });

  it('does not consume the seeded rng while applying movement', () => {
    const sim = new Simulation({ ...options, seed: 42 });
    const before = sim.getRngState();
    sim.enqueue({ type: 'move', x: 1, y: 0 });
    sim.tick();
    expect(sim.getRngState()).toBe(before);
    expect(new Simulation({ ...options, seed: 42 }).getRngState()).toBe(before);
  });

  it('advances only when the fixed clock crosses a tick boundary', () => {
    const sim = new Simulation(options);
    const clock = new FixedTickClock(20);
    sim.enqueue({ type: 'move', x: 1, y: 0 });
    const early = clock.advance(49, () => sim.tick());
    expect(early.steps).toBe(0);
    expect(sim.getState().tick).toBe(0);
    const crossed = clock.advance(1, () => sim.tick());
    expect(crossed.steps).toBe(1);
    expect(crossed.alpha).toBe(0);
    expect(sim.getState().player.x).toBe(1);
  });

  it('rejects an unknown attack style and a blank item id', () => {
    const sim = new Simulation(options);
    expect(() => sim.enqueue({ type: 'attack', style: 'bow' as 'melee' })).toThrow(/style/);
    expect(() => sim.enqueue({ type: 'use-item', itemId: '   ' })).toThrow(/item/);
  });
});
