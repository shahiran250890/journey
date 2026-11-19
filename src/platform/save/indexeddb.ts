import type { KeyValueStore } from '../../core/save/types.ts';

const DEFAULT_DB_NAME = 'mmorpg-poc';
const DEFAULT_STORE = 'saves';

export interface IndexedDbKeyValueStore extends KeyValueStore {
  close(): void;
}

export async function createIndexedDbKeyValueStore(options?: {
  dbName?: string;
  storeName?: string;
}): Promise<IndexedDbKeyValueStore> {
  const dbName = options?.dbName ?? DEFAULT_DB_NAME;
  const storeName = options?.storeName ?? DEFAULT_STORE;
  const db = await openDatabase(dbName, storeName);
  return {
    async get(key) {
      const tx = db.transaction(storeName, 'readonly');
      const value = await requestToPromise(tx.objectStore(storeName).get(key));
      await transactionDone(tx);
      return value === undefined ? null : value;
    },
    async set(key, value) {
      const tx = db.transaction(storeName, 'readwrite');
      await requestToPromise(tx.objectStore(storeName).put(value, key));
      await transactionDone(tx);
    },
    async delete(key) {
      const tx = db.transaction(storeName, 'readwrite');
      await requestToPromise(tx.objectStore(storeName).delete(key));
      await transactionDone(tx);
    },
    close() {
      db.close();
    },
  };
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}
