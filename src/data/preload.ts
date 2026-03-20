import { memoryCache } from '@/data/cache';
import { idbGet, idbSet } from '@/data/cache/indexeddb';

interface PreloadBundle {
  version: string;
  center: { lat: number; lng: number };
  entries: Record<string, unknown>;
}

let seeded = false;

/**
 * Seed IndexedDB + memory cache from pre-extracted JSON bundles.
 * Bundles live in public/preload/ and contain DuckDB query results
 * keyed by the same cache keys the app uses at runtime.
 *
 * Call once on app mount — idempotent, skips already-cached entries.
 */
export async function seedPreloadCache(): Promise<void> {
  if (seeded) return;
  seeded = true;

  try {
    const resp = await fetch('/preload/london.json');
    if (!resp.ok) return; // No preload bundle — normal S3 path

    const bundle: PreloadBundle = await resp.json();
    const entries = Object.entries(bundle.entries);

    let seededCount = 0;
    for (const [key, data] of entries) {
      // Skip if already in memory (user may have fresher data)
      if (memoryCache.get(key) !== undefined) continue;

      // Skip if already in IndexedDB
      const existing = await idbGet(key);
      if (existing !== undefined) {
        // Promote to memory cache for instant access
        memoryCache.set(key, existing);
        continue;
      }

      // Seed both caches
      memoryCache.set(key, data);
      await idbSet(key, data);
      seededCount++;
    }

    if (seededCount > 0) {
      console.log(`[preload] seeded ${seededCount}/${entries.length} cache entries from london.json`);
    } else {
      console.debug('[preload] all entries already cached');
    }
  } catch {
    // Silent — preload is a performance optimization, not critical
  }
}
