import { DarkWalletError } from "../errors.js";
import type { StorageProvider } from "./types.js";

type KvDbOptions = {
  dbName?: string;
  storeName?: string;
};

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export class IndexedDbStorageProvider implements StorageProvider {
  private readonly dbName: string;
  private readonly storeName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  public constructor(opts?: KvDbOptions) {
    this.dbName = opts?.dbName ?? "dark-wallet";
    this.storeName = opts?.storeName ?? "kv";
  }

  public static isAvailable(): boolean {
    return isIndexedDbAvailable();
  }

  private openDb(): Promise<IDBDatabase> {
    if (!isIndexedDbAvailable()) {
      throw new DarkWalletError(
        "ERR_UNSUPPORTED",
        "IndexedDB is not available in this environment.",
      );
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName);
      };
      req.onsuccess = () => resolve(req.result);
    });

    return this.dbPromise;
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const req = fn(store);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      req.onsuccess = () => resolve(req.result);
    });
  }

  public async get(key: string): Promise<string | null> {
    const value = await this.withStore("readonly", (store) => store.get(key));
    return typeof value === "string" ? value : null;
  }

  public async set(key: string, value: string): Promise<void> {
    await this.withStore("readwrite", (store) => store.put(value, key));
  }

  public async delete(key: string): Promise<void> {
    await this.withStore("readwrite", (store) => store.delete(key));
  }
}
