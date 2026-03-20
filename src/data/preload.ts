import { memoryCache } from '@/data/cache';
import { idbSet } from '@/data/cache/indexeddb';

interface PreloadBundle {
  version: string;
  center: { lat: number; lng: number };
  entries: Record<string, unknown>;
}

/**
 * Eagerly seed memory cache from pre-extracted JSON.
 * Called in main.tsx BEFORE React renders, so useSectionData
 * finds data in memory cache on first render (synchronous hit).
 *
 * IndexedDB seeding happens async in background (backup for page reloads).
 */
export function seedPreloadSync(bundle: PreloadBundle): void {
  for (const [key, data] of Object.entries(bundle.entries)) {
    memoryCache.set(key, data);
    // Background-seed IndexedDB too (fire-and-forget)
    idbSet(key, data);
  }
  console.log(`[preload] seeded ${Object.keys(bundle.entries).length} cache entries`);
}

/**
 * Fetch and seed from public/preload/ bundle.
 * Use this as fallback when bundle isn't inlined.
 */
export async function seedPreloadAsync(): Promise<void> {
  try {
    const resp = await fetch('/preload/london.json');
    if (!resp.ok) return;
    const bundle: PreloadBundle = await resp.json();
    seedPreloadSync(bundle);
  } catch {
    // Silent — preload is a performance optimization
  }
}
