const MAX_ENTRIES = 100;

/** Simple LRU cache backed by Map insertion order */
export class MemoryCache {
  private store = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    const val = this.store.get(key);
    if (val === undefined) return undefined;
    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, val);
    return val as T;
  }

  set<T>(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, value);
    // Evict oldest
    if (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Singleton instance for the app */
export const memoryCache = new MemoryCache();
