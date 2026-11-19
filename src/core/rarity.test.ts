import { describe, expect, it } from 'vitest';
import { loadShippedContent } from './content/shipped.ts';
import { rarityForTicket, rollRarity } from './rarity.ts';
import { SeededRng } from './rng.ts';

const tiers = loadShippedContent().rarity.tiers;

describe('rarity rolls', () => {
  it('maps tickets onto the approved odds', () => {
    expect(rarityForTicket(0, tiers)).toBe('common');
    expect(rarityForTicket(5499, tiers)).toBe('common');
    expect(rarityForTicket(5500, tiers)).toBe('rare');
    expect(rarityForTicket(8299, tiers)).toBe('rare');
    expect(rarityForTicket(8300, tiers)).toBe('epic');
    expect(rarityForTicket(9499, tiers)).toBe('epic');
    expect(rarityForTicket(9500, tiers)).toBe('legendary');
    expect(rarityForTicket(9899, tiers)).toBe('legendary');
    expect(rarityForTicket(9900, tiers)).toBe('mythical');
    expect(rarityForTicket(9989, tiers)).toBe('mythical');
    expect(rarityForTicket(9990, tiers)).toBe('unique');
    expect(rarityForTicket(9999, tiers)).toBe('unique');
  });

  it('rejects a ticket outside the weight scale', () => {
    expect(() => rarityForTicket(-1, tiers)).toThrow(/ticket/);
    expect(() => rarityForTicket(10000, tiers)).toThrow(/ticket/);
  });

  it('is deterministic for a seed', () => {
    const left = rollRarity(new SeededRng(5), tiers);
    const right = rollRarity(new SeededRng(5), tiers);
    expect(left).toBe(right);
    const probe = new SeededRng(5);
    const ticket = probe.nextInt(0, 10000);
    expect(left).toBe(rarityForTicket(ticket, tiers));
  });
});
