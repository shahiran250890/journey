import type { KeyValueStore } from './types.ts';

export function createMemoryKeyValueStore(): KeyValueStore {
  const records = new Map<string, unknown>();
  return {
    async get(key) {
      if (!records.has(key)) return null;
      return structuredClone(records.get(key));
    },
    async set(key, value) {
      records.set(key, structuredClone(value));
    },
    async delete(key) {
      records.delete(key);
    },
  };
}
