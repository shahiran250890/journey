import { z } from 'zod';

const statId = z.enum(['STR', 'AGI', 'INT', 'VIT', 'DEX', 'LUK']);

const statDefinition = z
  .object({
    id: statId,
    startingValue: z.literal(10),
    governs: z.string().min(1),
  })
  .strict();

const progressionSchema = z
  .object({
    startingLevel: z.literal(1),
    levelCap: z.null(),
    xpGrowthRatio: z.literal(1.2),
    levelUpAllStats: z.literal(2),
    freePointsPerLevel: z.literal(5),
    unspentPointsPersist: z.literal(true),
    tickHz: z.literal(20),
  })
  .strict();

function classEntry<Thresholds extends z.ZodType, Skills extends z.ZodType>(
  id: 'warrior' | 'archer' | 'mage',
  thresholds: Thresholds,
  skills: Skills,
) {
  return z
    .object({
      id: z.literal(id),
      thresholds,
      baseSkillCount: z.literal(2),
      extraSkillMinRarity: z.literal('legendary'),
      skills,
    })
    .strict();
}

function classlessAttack(id: string, name: string, style: 'melee' | 'ranged' | 'magic') {
  return z
    .object({
      id: z.literal(id),
      name: z.literal(name),
      kind: z.literal('attack'),
      style: z.literal(style),
    })
    .strict();
}

function classlessDodge(id: string, name: string) {
  return z
    .object({
      id: z.literal(id),
      name: z.literal(name),
      kind: z.literal('dodge'),
    })
    .strict();
}

function baseSkill(id: string, name: string, effect?: string) {
  if (effect === undefined) {
    return z
      .object({
        id: z.literal(id),
        name: z.literal(name),
        tier: z.literal('base'),
      })
      .strict();
  }
  return z
    .object({
      id: z.literal(id),
      name: z.literal(name),
      tier: z.literal('base'),
      effect: z.literal(effect),
    })
    .strict();
}

function extraSkill(id: string, name: string) {
  return z
    .object({
      id: z.literal(id),
      name: z.literal(name),
      tier: z.literal('extra'),
      minRarity: z.literal('legendary'),
    })
    .strict();
}

const classesSchema = z
  .object({
    multiThresholdChoice: z.literal('prompt'),
    classQuestRewardRarities: z.tuple([
      z.literal('legendary'),
      z.literal('mythical'),
      z.literal('unique'),
    ]),
    // Damage and cooldown are intentionally absent until those numbers are signed off.
    skillNumbers: z.literal('unagreed'),
    classlessSkills: z.tuple([
      classlessAttack('basic-melee-attack', 'Basic melee attack', 'melee'),
      classlessAttack('basic-ranged-attack', 'Basic ranged attack', 'ranged'),
      classlessAttack('basic-magic-attack', 'Basic magic attack', 'magic'),
      classlessDodge('dodge', 'Dodge'),
    ]),
    classes: z.tuple([
      classEntry(
        'warrior',
        z.object({ STR: z.literal(60), VIT: z.literal(40) }).strict(),
        z.tuple([
          baseSkill('cleave', 'Cleave', 'AoE'),
          baseSkill('shield-bash', 'Shield Bash', 'stun'),
          extraSkill('whirlwind', 'Whirlwind'),
        ]),
      ),
      classEntry(
        'archer',
        z.object({ AGI: z.literal(60), DEX: z.literal(40) }).strict(),
        z.tuple([
          baseSkill('multi-shot', 'Multi-Shot'),
          baseSkill('roll-back', 'Roll Back', 'dodge + shot'),
          extraSkill('arrow-rain', 'Arrow Rain'),
        ]),
      ),
      classEntry(
        'mage',
        z.object({ INT: z.literal(60), DEX: z.literal(40) }).strict(),
        z.tuple([
          baseSkill('fireball', 'Fireball'),
          baseSkill('frost-nova', 'Frost Nova', 'slow'),
          extraSkill('meteor', 'Meteor'),
        ]),
      ),
    ]),
  })
  .strict();

const rarityTier = (
  id: 'common' | 'rare' | 'epic' | 'legendary' | 'mythical' | 'unique',
  weight: number,
  percent: number,
  extraSkill: boolean,
) =>
  z
    .object({
      id: z.literal(id),
      weight: z.literal(weight),
      percent: z.literal(percent),
      extraSkill: z.literal(extraSkill),
    })
    .strict();

const raritySchema = z
  .object({
    weightScale: z.literal(10000),
    tiers: z.tuple([
      rarityTier('common', 5500, 55, false),
      rarityTier('rare', 2800, 28, false),
      rarityTier('epic', 1200, 12, false),
      rarityTier('legendary', 400, 4, true),
      rarityTier('mythical', 90, 0.9, true),
      rarityTier('unique', 10, 0.1, true),
    ]),
  })
  .strict()
  .superRefine((rarity, context) => {
    const sum = rarity.tiers.reduce((total, tier) => total + tier.weight, 0);
    if (sum !== rarity.weightScale) {
      context.addIssue({
        code: 'custom',
        message: `rarity weights sum to ${sum}, expected ${rarity.weightScale}`,
      });
    }
    for (const tier of rarity.tiers) {
      if (Math.round(tier.percent * 100) !== tier.weight) {
        context.addIssue({
          code: 'custom',
          message: `${tier.id} percent does not match its weight`,
        });
      }
    }
  });

const rulesSchema = z
  .object({
    desktopBrowsers: z.tuple([z.literal('chrome'), z.literal('firefox'), z.literal('edge')]),
    attackStyles: z.tuple([z.literal('melee'), z.literal('magic'), z.literal('ranged')]),
    death: z
      .object({
        respawn: z.literal('town'),
        losses: z.tuple([]),
      })
      .strict(),
    classChange: z
      .object({
        minRarity: z.literal('epic'),
        bossDropChanceOutOf10000: z.literal(500),
        guaranteedFromOneTimeTownQuest: z.literal(true),
        revertsToClassless: z.literal(true),
        keeps: z.tuple([
          z.literal('level'),
          z.literal('stats'),
          z.literal('gear'),
          z.literal('questProgress'),
        ]),
      })
      .strict(),
  })
  .strict();

const gearSchema = z
  .object({
    slots: z.tuple([
      z.literal('weapon'),
      z.literal('armour'),
      z.literal('helmet'),
      z.literal('boots'),
      z.literal('accessory'),
    ]),
    artifactSlot: z.literal('artifact'),
    artifactSeparateFrom: z.literal('accessory'),
    carryWeightEnforced: z.literal(false),
  })
  .strict();

const rewardKinds = z.tuple([z.literal('xp'), z.literal('gold'), z.literal('item')]);

const questsSchema = z
  .object({
    npc: z.literal('town-quest-npc'),
    quests: z.tuple([
      z
        .object({
          id: z.literal('example-slay-wolves'),
          kind: z.literal('kill'),
          target: z.literal('wolf'),
          count: z.literal(10),
          rewardKinds,
          example: z.literal(true),
        })
        .strict(),
      z
        .object({
          id: z.literal('example-bring-herbs'),
          kind: z.literal('collect'),
          target: z.literal('herb'),
          count: z.literal(5),
          rewardKinds,
          example: z.literal(true),
        })
        .strict(),
      z
        .object({
          id: z.literal('example-defeat-boss'),
          kind: z.literal('dungeon'),
          target: z.literal('dungeon-boss'),
          count: z.literal(1),
          rewardKinds,
          example: z.literal(true),
        })
        .strict(),
      z
        .object({
          id: z.literal('special-class-quest'),
          kind: z.literal('class'),
          requiresClassless: z.literal(true),
          playerChoosesClass: z.literal(true),
          rewardRarities: z.tuple([
            z.literal('legendary'),
            z.literal('mythical'),
            z.literal('unique'),
          ]),
        })
        .strict(),
      z
        .object({
          id: z.literal('class-change-town-quest'),
          kind: z.literal('town'),
          oneTime: z.literal(true),
          guaranteedReward: z.literal('class-change'),
        })
        .strict(),
    ]),
  })
  .strict();

const artifactsSchema = z
  .object({
    examples: z.tuple([
      z
        .object({
          id: z.literal('example-crit-chance'),
          passive: z.literal('crit-chance'),
          critChanceBonus: z.literal(0.2),
        })
        .strict(),
      z
        .object({
          id: z.literal('example-heal-on-kill'),
          passive: z.literal('heal-on-kill'),
        })
        .strict(),
    ]),
  })
  .strict();

const controlsSchema = z
  .object({
    move: z.tuple([z.literal('KeyW'), z.literal('KeyA'), z.literal('KeyS'), z.literal('KeyD')]),
    aim: z.literal('mouse'),
    basicAttack: z.literal('MouseLeft'),
    switchStyle: z.tuple([z.literal('Digit1'), z.literal('Digit2'), z.literal('Digit3')]),
    skillHotkeys: z.literal('unspecified'),
  })
  .strict();

const savePolicySchema = z
  .object({
    status: z.literal('proposed'),
    backend: z.literal('indexeddb'),
    slots: z.literal(3),
    autosaveIntervalSeconds: z.literal(30),
    autosaveOn: z.tuple([
      z.literal('key-event'),
      z.literal('interval'),
      z.literal('tab-hidden'),
      z.literal('tab-close'),
    ]),
    titleScreen: z.tuple([z.literal('continue'), z.literal('new-game')]),
    newGameOverwriteConfirm: z.literal(true),
    exportImport: z.literal(true),
    disclosures: z.tuple([
      z.literal('Saves can be edited by a determined user.'),
      z.literal('Saves are lost if site or browser data is cleared.'),
    ]),
  })
  .strict();

const worldSchema = z
  .object({
    moveSpeedPerTick: z.literal(0.15),
    playerRadius: z.literal(0.28),
    transitionLockTicks: z.literal(15),
    zones: z.tuple([
      z
        .object({
          id: z.literal('town'),
          role: z.literal('starter-town'),
          features: z.tuple([z.literal('quest-npc')]),
          map: z.literal('maps/town.tmj'),
        })
        .strict(),
      z
        .object({
          id: z.literal('overworld'),
          role: z.literal('open-zone'),
          monsterTypeCount: z
            .object({
              min: z.literal(3),
              max: z.literal(4),
            })
            .strict(),
          map: z.literal('maps/overworld.tmj'),
        })
        .strict(),
      z
        .object({
          id: z.literal('dungeon'),
          role: z.literal('dungeon'),
          features: z.tuple([z.literal('end-boss')]),
          map: z.literal('maps/dungeon.tmj'),
          status: z.literal('stub'),
          continuesIn: z.literal('M5'),
        })
        .strict(),
    ]),
  })
  .strict();

const statsSchema = z
  .object({
    stats: z.tuple([
      statDefinition.extend({ id: z.literal('STR') }),
      statDefinition.extend({ id: z.literal('AGI') }),
      statDefinition.extend({ id: z.literal('INT') }),
      statDefinition.extend({ id: z.literal('VIT') }),
      statDefinition.extend({ id: z.literal('DEX') }),
      statDefinition.extend({ id: z.literal('LUK') }),
    ]),
  })
  .strict();

export const contentSchema = z
  .object({
    progression: progressionSchema,
    stats: statsSchema,
    classes: classesSchema,
    rarity: raritySchema,
    rules: rulesSchema,
    gear: gearSchema,
    artifacts: artifactsSchema,
    quests: questsSchema,
    controls: controlsSchema,
    savePolicy: savePolicySchema,
    world: worldSchema,
  })
  .strict();

export type ContentFileBundle = z.infer<typeof contentSchema>;
