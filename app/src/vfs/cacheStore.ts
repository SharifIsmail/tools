export interface CacheStore<T = unknown> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
}

export class InMemoryCacheStore<T = unknown> implements CacheStore<T> {
  private map = new Map<string, T>();

  async get(key: string): Promise<T | undefined> {
    return this.map.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }
}
