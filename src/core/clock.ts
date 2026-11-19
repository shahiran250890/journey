const MAX_CATCH_UP_STEPS = 8;

export interface TickAdvance {
  steps: number;
  alpha: number;
}

/**
 * Fixed-step clock. The renderer calls advance() with the frame delta and
 * interpolates with alpha. A stall is capped so one long frame cannot
 * simulate an unbounded number of ticks.
 */
export class FixedTickClock {
  private accumulatorMs = 0;
  private readonly stepMs: number;

  constructor(hz: number) {
    if (!(hz > 0)) throw new Error('tick rate must be positive');
    this.stepMs = 1000 / hz;
  }

  advance(deltaMs: number, step: () => void): TickAdvance {
    if (deltaMs < 0) throw new Error('delta must not be negative');
    this.accumulatorMs += deltaMs;
    let steps = 0;
    while (this.accumulatorMs >= this.stepMs && steps < MAX_CATCH_UP_STEPS) {
      step();
      this.accumulatorMs -= this.stepMs;
      steps += 1;
    }
    if (steps === MAX_CATCH_UP_STEPS && this.accumulatorMs >= this.stepMs) {
      this.accumulatorMs = 0;
    }
    return { steps, alpha: this.accumulatorMs / this.stepMs };
  }
}
