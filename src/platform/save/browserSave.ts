import { createMemoryKeyValueStore } from '../../core/save/memory.ts';
import { M0_SAVE_VERSION, m0Migrations, parseM0Save, type SaveData } from '../../core/save/m0.ts';
import { createSaveStore } from '../../core/save/store.ts';
import type { SaveStore } from '../../core/save/types.ts';
import { createIndexedDbKeyValueStore } from './indexeddb.ts';

export async function createBrowserSaveStore(): Promise<SaveStore<SaveData>> {
  const options = {
    version: M0_SAVE_VERSION,
    migrations: m0Migrations,
    parse: parseM0Save,
  };
  if (typeof indexedDB === 'undefined') {
    return createSaveStore({ ...options, backend: createMemoryKeyValueStore() });
  }
  try {
    const backend = await createIndexedDbKeyValueStore();
    return createSaveStore({ ...options, backend });
  } catch (error) {
    console.warn('IndexedDB is unavailable. The save stub is in memory only.', error);
    return createSaveStore({ ...options, backend: createMemoryKeyValueStore() });
  }
}
