import { z } from 'zod';
import type { Migration } from './types.ts';

export const M0_SAVE_VERSION = 1;

const saveDataSchema = z
  .object({
    revision: z.literal(1),
    placeholder: z.literal(true),
  })
  .strict();

export type SaveData = z.infer<typeof saveDataSchema>;

export function parseM0Save(data: unknown): SaveData {
  return saveDataSchema.parse(data);
}

/**
 * Version 0 is the pre-schema blob. Milestone 3 replaces SaveData and adds
 * the next migration; this hook only proves the pipe.
 */
export const m0Migrations: readonly Migration[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    migrate(data) {
      if (typeof data !== 'object' || data === null) {
        throw new Error('version 0 save must be an object');
      }
      return { revision: 1, placeholder: true };
    },
  },
];
