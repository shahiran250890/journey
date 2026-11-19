export const STAT_IDS = ['STR', 'AGI', 'INT', 'VIT', 'DEX', 'LUK'] as const;

export type StatId = (typeof STAT_IDS)[number];

export type Stats = Record<StatId, number>;

export interface LevelUpRules {
  levelUpAllStats: number;
  freePointsPerLevel: number;
}

export interface ClassThresholds {
  id: string;
  thresholds: Partial<Record<StatId, number>>;
}

/** XP to leave `level`, relative to the XP required to leave level 1. */
export function xpMultiplierForLevel(level: number, growthRatio: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('level must be an integer >= 1');
  }
  if (!(growthRatio > 0)) throw new Error('growth ratio must be positive');
  return growthRatio ** (level - 1);
}

export function applyLevelUp(
  stats: Stats,
  unspentPoints: number,
  rules: LevelUpRules,
): { stats: Stats; unspentPoints: number } {
  const next: Stats = { ...stats };
  for (const id of STAT_IDS) next[id] += rules.levelUpAllStats;
  return {
    stats: next,
    unspentPoints: unspentPoints + rules.freePointsPerLevel,
  };
}

export function classIdsMeetingThresholds(
  stats: Stats,
  classes: readonly ClassThresholds[],
): string[] {
  return classes
    .filter((entry) =>
      Object.entries(entry.thresholds).every(([stat, minimum]) => {
        if (minimum === undefined) return true;
        return stats[stat as StatId] >= minimum;
      }),
    )
    .map((entry) => entry.id);
}
