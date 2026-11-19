import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createSaveStore } from '../../core/save/store.ts';
import { createIndexedDbKeyValueStore } from './indexeddb.ts';

describe('IndexedDB save backend', () => {
  it('saves, loads, and clears a versioned record', async () => {
    const backend = await createIndexedDbKeyValueStore({
      dbName: `mmorpg-poc-test-${Math.random().toString(16).slice(2)}`,
    });
    const store = createSaveStore({
      backend,
      version: 1,
      migrations: [
        {
          fromVersion: 0,
          toVersion: 1,
          migrate: () => ({ revision: 1, placeholder: true }),
        },
      ],
      parse(data) {
        if (typeof data !== 'object' || data === null || !('placeholder' in data)) {
          throw new Error('invalid save');
        }
        return { revision: 1 as const, placeholder: true as const };
      },
    });

    await backend.set('slot-1', { version: 0, data: { legacy: true } });
    expect(await store.load('slot-1')).toEqual({ revision: 1, placeholder: true });

    await store.save('slot-1', { revision: 1, placeholder: true });
    expect(await store.load('slot-1')).toEqual({ revision: 1, placeholder: true });
    await store.clear('slot-1');
    expect(await store.load('slot-1')).toBeNull();
    backend.close();
  });
});
