const DB_NAME = 'chrono-city-cache';
const DB_VERSION = 1;
const STORE_NAME = 'queries';

/** Max age for cached entries: 7 days */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry) { resolve(undefined); return; }
        // Expired?
        if (Date.now() - entry.timestamp > MAX_AGE_MS) {
          resolve(undefined);
          return;
        }
        resolve(entry.data as T);
      };
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: CacheEntry = { key, data, timestamp: Date.now() };
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Silently fail — IndexedDB is a perf optimization, not critical
  }
}

/** Remove expired entries (call periodically or on startup) */
export async function idbPrune(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const entry = cursor.value as CacheEntry;
      if (Date.now() - entry.timestamp > MAX_AGE_MS) {
        cursor.delete();
      }
      cursor.continue();
    };
  } catch {
    // Silent
  }
}
