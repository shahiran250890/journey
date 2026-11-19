import { describe, expect, it } from 'vitest';
import { loadContent } from './load.ts';
import { loadShippedContent, shippedContentInput } from './shipped.ts';

describe('content schema', () => {
  it('accepts the shipped config and locks the approved numbers', () => {
    const content = loadShippedContent();
    expect(content.progression).toMatchObject({
      startingLevel: 1,
      levelCap: null,
      xpGrowthRatio: 1.2,
      levelUpAllStats: 2,
      freePointsPerLevel: 5,
      unspentPointsPersist: true,
      tickHz: 20,
    });
    expect(content.stats.map((stat) => [stat.id, stat.startingValue])).toEqual([
      ['STR', 10],
      ['AGI', 10],
      ['INT', 10],
      ['VIT', 10],
      ['DEX', 10],
      ['LUK', 10],
    ]);
    expect(content.classes.classes.map((entry) => [entry.id, entry.thresholds])).toEqual([
      ['warrior', { STR: 60, VIT: 40 }],
      ['archer', { AGI: 60, DEX: 40 }],
      ['mage', { INT: 60, DEX: 40 }],
    ]);
    expect(content.classes.classes.every((entry) => entry.baseSkillCount === 2)).toBe(true);
    expect(content.classes.skillNumbers).toBe('unagreed');
    expect(content.classes.classlessSkills.map((skill) => skill.name)).toEqual([
      'Basic melee attack',
      'Basic ranged attack',
      'Basic magic attack',
      'Dodge',
    ]);
    expect(
      content.classes.classes.map((entry) => [entry.id, entry.skills.map((skill) => skill.name)]),
    ).toEqual([
      ['warrior', ['Cleave', 'Shield Bash', 'Whirlwind']],
      ['archer', ['Multi-Shot', 'Roll Back', 'Arrow Rain']],
      ['mage', ['Fireball', 'Frost Nova', 'Meteor']],
    ]);
    expect(content.classes.classes[0]!.skills[0]).toMatchObject({ tier: 'base', effect: 'AoE' });
    expect(content.classes.classes[0]!.skills[1]).toMatchObject({ tier: 'base', effect: 'stun' });
    expect(content.classes.classes[0]!.skills[2]).toMatchObject({
      tier: 'extra',
      minRarity: 'legendary',
    });
    expect(content.classes.classes[1]!.skills[1]).toMatchObject({ effect: 'dodge + shot' });
    expect(content.classes.classes[2]!.skills[1]).toMatchObject({ effect: 'slow' });
    for (const entry of content.classes.classes) {
      const baseSkills = entry.skills.filter((skill) => skill.tier === 'base');
      const extraSkills = entry.skills.filter((skill) => skill.tier === 'extra');
      expect(baseSkills).toHaveLength(entry.baseSkillCount);
      expect(
        extraSkills.map((skill) => ('minRarity' in skill ? skill.minRarity : undefined)),
      ).toEqual([entry.extraSkillMinRarity]);
      for (const skill of entry.skills) {
        expect(skill).not.toHaveProperty('damage');
        expect(skill).not.toHaveProperty('cooldown');
      }
    }
    expect(content.rarity.tiers.map((tier) => [tier.id, tier.percent, tier.weight])).toEqual([
      ['common', 55, 5500],
      ['rare', 28, 2800],
      ['epic', 12, 1200],
      ['legendary', 4, 400],
      ['mythical', 0.9, 90],
      ['unique', 0.1, 10],
    ]);
    expect(content.rarity.tiers.reduce((sum, tier) => sum + tier.weight, 0)).toBe(10000);
    expect(content.rules.death).toEqual({ respawn: 'town', losses: [] });
    expect(content.rules.classChange).toMatchObject({
      minRarity: 'epic',
      bossDropChanceOutOf10000: 500,
      guaranteedFromOneTimeTownQuest: true,
      revertsToClassless: true,
    });
    expect(content.quests.quests.find((quest) => quest.id === 'example-slay-wolves')).toMatchObject(
      { kind: 'kill', count: 10, target: 'wolf' },
    );
    expect(content.artifacts.examples.map((artifact) => artifact.id)).toEqual([
      'example-crit-chance',
      'example-heal-on-kill',
    ]);
    expect(content.savePolicy).toMatchObject({ slots: 3, autosaveIntervalSeconds: 30 });
  });

  it('rejects a starting stat other than 10', () => {
    const raw = shippedContentInput();
    raw.stats.stats[0]!.startingValue = 11;
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects the old +10 level-up and the old class thresholds', () => {
    const growth = shippedContentInput();
    growth.progression.levelUpAllStats = 10;
    expect(() => loadContent(growth)).toThrow();

    const thresholds = shippedContentInput();
    thresholds.classes.classes[0]!.thresholds = { STR: 100, VIT: 50 };
    expect(() => loadContent(thresholds)).toThrow();
  });

  it('rejects a rarity table that does not sum to the weight scale', () => {
    const raw = shippedContentInput();
    raw.rarity.tiers[0]!.weight = 5400;
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects a death rule that takes something away', () => {
    const raw = shippedContentInput();
    raw.rules.death.losses = ['gold'];
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects a class-change boss drop other than 5%', () => {
    const raw = shippedContentInput();
    raw.rules.classChange.bossDropChanceOutOf10000 = 1000;
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects a skill name that was not signed off', () => {
    const raw = shippedContentInput();
    raw.classes.classes[0]!.skills[0]!.name = 'Slash';
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects a classless kit that drops a signed-off skill', () => {
    const raw = shippedContentInput();
    raw.classes.classlessSkills = raw.classes.classlessSkills.slice(0, 3);
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects an extra skill below legendary', () => {
    const raw = shippedContentInput();
    const whirlwind = raw.classes.classes[0]!.skills[2]!;
    whirlwind.minRarity = 'epic';
    expect(() => loadContent(raw)).toThrow();
  });

  it('rejects damage and cooldown numbers while skill numbers are unagreed', () => {
    const damage = shippedContentInput();
    Object.assign(damage.classes.classes[0]!.skills[0]!, { damage: 10 });
    expect(() => loadContent(damage)).toThrow();

    const cooldown = shippedContentInput();
    Object.assign(cooldown.classes.classes[2]!.skills[1]!, { cooldown: 3 });
    expect(() => loadContent(cooldown)).toThrow();
  });
});
