import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from './memory.ts';
import { M0_SAVE_VERSION, m0Migrations, parseM0Save } from './m0.ts';
import { applyMigrations } from './migrate.ts';
import { createSaveStore } from './store.ts';

const version = 1;

describe('save migrations', () => {
  it('runs the migration hook when the stored version is older', () => {
    let calls = 0;
    const migrated = applyMigrations(
      { version: 0, data: { legacy: true } },
      [
        {
          fromVersion: 0,
          toVersion: 1,
          migrate(data) {
            calls += 1;
            expect(data).toEqual({ legacy: true });
            return { revision: 1, placeholder: true };
          },
        },
      ],
      version,
    );
    expect(calls).toBe(1);
    expect(migrated).toEqual({ version: 1, data: { revision: 1, placeholder: true } });
  });

  it('upgrades an empty version 0 record into the milestone 0 stub', () => {
    const result = applyMigrations({ version: 0, data: {} }, m0Migrations, M0_SAVE_VERSION);
    expect(result.version).toBe(1);
    expect(parseM0Save(result.data)).toEqual({ revision: 1, placeholder: true });
  });

  it('refuses a save newer than this client and a missing step', () => {
    expect(() => applyMigrations({ version: 2, data: {} }, [], version)).toThrow(/newer/);
    expect(() => applyMigrations({ version: 0, data: {} }, [], version)).toThrow(/migration/);
  });
});

describe('save store', () => {
  it('round-trips the current version without calling the migration hook', async () => {
    let calls = 0;
    const store = createSaveStore({
      backend: createMemoryKeyValueStore(),
      version,
      migrations: [
        {
          fromVersion: 0,
          toVersion: 1,
          migrate() {
            calls += 1;
            return { revision: 1, placeholder: true };
          },
        },
      ],
      parse(data) {
        if (
          typeof data !== 'object' ||
          data === null ||
          !('revision' in data) ||
          data.revision !== 1
        ) {
          throw new Error('invalid save');
        }
        return { revision: 1 as const, placeholder: true as const };
      },
    });

    expect(await store.load('slot-1')).toBeNull();
    await store.save('slot-1', { revision: 1, placeholder: true });
    expect(await store.load('slot-1')).toEqual({ revision: 1, placeholder: true });
    expect(calls).toBe(0);
    await store.clear('slot-1');
    expect(await store.load('slot-1')).toBeNull();
  });

  it('migrates a version 0 record the first time it is loaded', async () => {
    const backend = createMemoryKeyValueStore();
    await backend.set('slot-1', { version: 0, data: { legacy: true } });
    const store = createSaveStore({
      backend,
      version,
      migrations: [
        {
          fromVersion: 0,
          toVersion: 1,
          migrate: () => ({ revision: 1, placeholder: true }),
        },
      ],
      parse: (data) => {
        if (typeof data !== 'object' || data === null || !('placeholder' in data)) {
          throw new Error('invalid save');
        }
        return { revision: 1 as const, placeholder: true as const };
      },
    });
    expect(await store.load('slot-1')).toEqual({ revision: 1, placeholder: true });
  });
});
