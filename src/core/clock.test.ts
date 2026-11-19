import { describe, expect, it } from 'vitest';
import { FixedTickClock } from './clock.ts';

describe('FixedTickClock', () => {
  it('runs one 50ms step at 20 Hz and reports the remainder as alpha', () => {
    const clock = new FixedTickClock(20);
    const first = clock.advance(30, () => undefined);
    expect(first.steps).toBe(0);
    expect(first.alpha).toBeCloseTo(0.6);

    const second = clock.advance(30, () => undefined);
    expect(second.steps).toBe(1);
    expect(second.alpha).toBeCloseTo(0.2);
  });

  it('runs two steps when 125ms elapses at once', () => {
    const clock = new FixedTickClock(20);
    let steps = 0;
    const result = clock.advance(125, () => {
      steps += 1;
    });
    expect(steps).toBe(2);
    expect(result.steps).toBe(2);
    expect(result.alpha).toBeCloseTo(0.5);
  });

  it('caps catch-up so a long stall cannot spiral', () => {
    const clock = new FixedTickClock(20);
    let steps = 0;
    const result = clock.advance(10_000, () => {
      steps += 1;
    });
    expect(steps).toBe(8);
    expect(result.steps).toBe(8);
    expect(result.alpha).toBe(0);
  });

  it('rejects a non-positive rate and a negative delta', () => {
    expect(() => new FixedTickClock(0)).toThrow(/positive/);
    const clock = new FixedTickClock(20);
    expect(() => clock.advance(-1, () => undefined)).toThrow(/negative/);
  });
});
