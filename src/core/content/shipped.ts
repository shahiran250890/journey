import artifacts from '../../../content/artifacts.json' with { type: 'json' };
import classes from '../../../content/classes.json' with { type: 'json' };
import controls from '../../../content/controls.json' with { type: 'json' };
import gear from '../../../content/gear.json' with { type: 'json' };
import progression from '../../../content/progression.json' with { type: 'json' };
import quests from '../../../content/quests.json' with { type: 'json' };
import rarity from '../../../content/rarity.json' with { type: 'json' };
import rules from '../../../content/rules.json' with { type: 'json' };
import savePolicy from '../../../content/save-policy.json' with { type: 'json' };
import stats from '../../../content/stats.json' with { type: 'json' };
import world from '../../../content/world.json' with { type: 'json' };
import { loadContent, type ContentBundle } from './load.ts';

export interface ContentDraft {
  progression: {
    startingLevel: number;
    levelCap: null;
    xpGrowthRatio: number;
    levelUpAllStats: number;
    freePointsPerLevel: number;
    unspentPointsPersist: boolean;
    tickHz: number;
  };
  stats: { stats: { id: string; startingValue: number; governs: string }[] };
  classes: {
    multiThresholdChoice: string;
    classQuestRewardRarities: string[];
    skillNumbers: string;
    classlessSkills: {
      id: string;
      name: string;
      kind: string;
      style?: string;
    }[];
    classes: {
      id: string;
      thresholds: Record<string, number>;
      baseSkillCount: number;
      extraSkillMinRarity: string;
      skills: {
        id: string;
        name: string;
        tier: string;
        effect?: string;
        minRarity?: string;
      }[];
    }[];
  };
  rarity: {
    weightScale: number;
    tiers: { id: string; weight: number; percent: number; extraSkill: boolean }[];
  };
  rules: {
    desktopBrowsers: string[];
    attackStyles: string[];
    death: { respawn: string; losses: string[] };
    classChange: {
      minRarity: string;
      bossDropChanceOutOf10000: number;
      guaranteedFromOneTimeTownQuest: boolean;
      revertsToClassless: boolean;
      keeps: string[];
    };
  };
  gear: unknown;
  artifacts: unknown;
  quests: unknown;
  controls: unknown;
  savePolicy: unknown;
  world: unknown;
}

export function shippedContentInput(): ContentDraft {
  return structuredClone({
    progression,
    stats,
    classes,
    rarity,
    rules,
    gear,
    artifacts,
    quests,
    controls,
    savePolicy,
    world,
  }) as unknown as ContentDraft;
}

export function loadShippedContent(): ContentBundle {
  return loadContent(shippedContentInput());
}
