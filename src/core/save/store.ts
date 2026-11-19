import { applyMigrations } from './migrate.ts';
import type { KeyValueStore, Migration, SaveStore, VersionedRecord } from './types.ts';

export interface SaveStoreOptions<T> {
  backend: KeyValueStore;
  version: number;
  migrations: readonly Migration[];
  parse: (data: unknown) => T;
}

function isVersionedRecord(value: unknown): value is VersionedRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'number' &&
    'data' in value
  );
}

export function createSaveStore<T>(options: SaveStoreOptions<T>): SaveStore<T> {
  return {
    async load(slotId) {
      const raw = await options.backend.get(slotId);
      if (raw == null) return null;
      if (!isVersionedRecord(raw)) throw new Error('invalid save record');
      const migrated = applyMigrations(raw, options.migrations, options.version);
      return options.parse(migrated.data);
    },
    async save(slotId, data) {
      const parsed = options.parse(data);
      await options.backend.set(slotId, { version: options.version, data: parsed });
    },
    async clear(slotId) {
      await options.backend.delete(slotId);
    },
  };
}
