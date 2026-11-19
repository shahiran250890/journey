export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate: (data: unknown) => unknown;
}

export interface VersionedRecord {
  version: number;
  data: unknown;
}

export interface SaveStore<T> {
  load(slotId: string): Promise<T | null>;
  save(slotId: string, data: T): Promise<void>;
  clear(slotId: string): Promise<void>;
}
