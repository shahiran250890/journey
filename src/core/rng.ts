/**
 * Mulberry32. Same seed, same sequence, so a future server can reproduce rolls.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
    this.state = seed >>> 0;
  }

  static fromState(state: number): SeededRng {
    if (!Number.isInteger(state) || state < 0) {
      throw new Error('state must be a non-negative integer');
    }
    const rng = new SeededRng(0);
    rng.state = state >>> 0;
    return rng;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [minInclusive, maxExclusive). */
  nextInt(minInclusive: number, maxExclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new Error('bounds must be integers');
    }
    if (maxExclusive <= minInclusive) throw new Error('empty integer range');
    const span = maxExclusive - minInclusive;
    return minInclusive + Math.floor(this.next() * span);
  }

  getState(): number {
    return this.state >>> 0;
  }
}
