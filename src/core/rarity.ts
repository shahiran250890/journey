import type { SeededRng } from './rng.ts';

export interface RarityWeight {
  id: string;
  weight: number;
}

export function rarityForTicket(ticket: number, tiers: readonly RarityWeight[]): string {
  if (!Number.isInteger(ticket) || ticket < 0) throw new Error('ticket out of range');
  let cursor = 0;
  for (const tier of tiers) {
    cursor += tier.weight;
    if (ticket < cursor) return tier.id;
  }
  throw new Error('ticket out of range');
}

export function rollRarity(rng: SeededRng, tiers: readonly RarityWeight[]): string {
  const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  return rarityForTicket(rng.nextInt(0, total), tiers);
}
