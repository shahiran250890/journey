import { describe, expect, it } from 'vitest';
import { SeededRng } from './rng.ts';

describe('SeededRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const first = [a.next(), a.next(), a.next()];
    const second = [b.next(), b.next(), b.next()];
    expect(first).toEqual(second);
  });

  it('produces a different sequence for a different seed', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('returns floats in [0, 1)', () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns integers in the half-open range', () => {
    const rng = new SeededRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.nextInt(3, 8);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(8);
    }
  });

  it('restores a sequence from its internal state', () => {
    const rng = new SeededRng(1234);
    rng.next();
    rng.next();
    const state = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next()];
    const restored = SeededRng.fromState(state);
    expect([restored.next(), restored.next(), restored.next()]).toEqual(expected);
  });

  it('rejects a non-integer seed and an empty integer range', () => {
    expect(() => new SeededRng(1.5)).toThrow(/integer/);
    const rng = new SeededRng(1);
    expect(() => rng.nextInt(4, 4)).toThrow(/range/);
  });
});
