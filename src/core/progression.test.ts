import { describe, expect, it } from 'vitest';
import { loadShippedContent } from './content/shipped.ts';
import { applyLevelUp, classIdsMeetingThresholds, xpMultiplierForLevel } from './progression.ts';

const content = loadShippedContent();

describe('progression rules from shipped content', () => {
  it('makes each level cost 20% more XP than the previous', () => {
    const ratio = content.progression.xpGrowthRatio;
    expect(xpMultiplierForLevel(1, ratio)).toBe(1);
    expect(xpMultiplierForLevel(2, ratio)).toBeCloseTo(1.2);
    expect(xpMultiplierForLevel(3, ratio)).toBeCloseTo(1.44);
    expect(xpMultiplierForLevel(4, ratio) / xpMultiplierForLevel(3, ratio)).toBeCloseTo(ratio);
  });

  it('adds 2 to every stat and grants 5 free points on level-up', () => {
    const stats = {
      STR: 10,
      AGI: 10,
      INT: 10,
      VIT: 10,
      DEX: 10,
      LUK: 10,
    };
    const next = applyLevelUp(stats, 1, content.progression);
    expect(next.stats).toEqual({
      STR: 12,
      AGI: 12,
      INT: 12,
      VIT: 12,
      DEX: 12,
      LUK: 12,
    });
    expect(next.unspentPoints).toBe(6);
    expect(stats.STR).toBe(10);
  });

  it('matches a class only when every approved threshold is met', () => {
    const base = { STR: 10, AGI: 10, INT: 10, VIT: 10, DEX: 10, LUK: 10 };
    expect(classIdsMeetingThresholds(base, content.classes.classes)).toEqual([]);
    expect(
      classIdsMeetingThresholds({ ...base, STR: 60, VIT: 40 }, content.classes.classes),
    ).toEqual(['warrior']);
    expect(
      classIdsMeetingThresholds({ ...base, STR: 59, VIT: 40 }, content.classes.classes),
    ).toEqual([]);
    expect(
      classIdsMeetingThresholds(
        { STR: 60, AGI: 60, INT: 60, VIT: 40, DEX: 40, LUK: 10 },
        content.classes.classes,
      ),
    ).toEqual(['warrior', 'archer', 'mage']);
  });
});
