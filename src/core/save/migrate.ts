import type { Migration, VersionedRecord } from './types.ts';

export function applyMigrations(
  record: VersionedRecord,
  migrations: readonly Migration[],
  targetVersion: number,
): VersionedRecord {
  if (!Number.isInteger(record.version)) throw new Error('save version must be an integer');
  if (record.version > targetVersion) {
    throw new Error(`save version ${record.version} is newer than this client`);
  }
  let current = record;
  let guard = 0;
  while (current.version < targetVersion) {
    const step = migrations.find((migration) => migration.fromVersion === current.version);
    if (!step || step.toVersion !== current.version + 1) {
      throw new Error(`no migration from version ${current.version}`);
    }
    current = { version: step.toVersion, data: step.migrate(current.data) };
    guard += 1;
    if (guard > 32) throw new Error('migration did not reach the target version');
  }
  return current;
}
