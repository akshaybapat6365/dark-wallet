import type { StorageProvider } from "./types.js";

export class InMemoryStorageProvider implements StorageProvider {
  private readonly map = new Map<string, string>();

  public async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  public async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}
