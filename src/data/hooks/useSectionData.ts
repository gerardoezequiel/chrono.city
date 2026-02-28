import { useState, useEffect, useRef } from 'react';
import type { BBox } from '@/shared/types/geo';
import type { DataState, SectionId } from '@/shared/types/metrics';
import { memoryCache, cacheKey } from '@/data/cache';
import { idbGet, idbSet } from '@/data/cache/indexeddb';
import { getSectionConfig } from '@/config/sections';

interface UseSectionDataReturn<T> {
  data: T | null;
  state: DataState;
  error: string | null;
  queryMs: number | null;
}

/** Fetch section data with two-layer cache: memory LRU → IndexedDB → S3 query */
export function useSectionData<T>(
  sectionId: SectionId,
  bbox: BBox | null,
  /** If false, defer the query until the section becomes visible */
  enabled = true,
): UseSectionDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<DataState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [queryMs, setQueryMs] = useState<number | null>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!bbox || !enabled) {
      setData(null);
      setState('idle');
      setError(null);
      setQueryMs(null);
      return;
    }

    const config = getSectionConfig(sectionId);
    if (!config?.query) return;

    const key = cacheKey(bbox, sectionId);

    // Layer 1: Memory cache (instant)
    const cached = memoryCache.get<T>(key);
    if (cached !== undefined) {
      setData(cached);
      setState('loaded');
      setError(null);
      setQueryMs(0);
      console.debug(`[${sectionId}] memory cache HIT`);
      return;
    }

    const requestId = ++abortRef.current;

    setState('loading');
    setError(null);

    // Layer 2: IndexedDB (fast, ~1-5ms), then Layer 3: S3 query
    (async () => {
      // Check IndexedDB
      const idbResult = await idbGet<T>(key);
      if (abortRef.current !== requestId) return;

      if (idbResult !== undefined) {
        memoryCache.set(key, idbResult);
        setData(idbResult);
        setState('loaded');
        setQueryMs(1); // ~instant from IDB
        console.debug(`[${sectionId}] IndexedDB cache HIT`);
        return;
      }

      // Layer 3: DuckDB query against S3
      const t0 = performance.now();
      try {
        const result = await config.query!(bbox);
        if (abortRef.current !== requestId) return;

        const ms = performance.now() - t0;
        const typed = result as T;

        // Write to both caches
        memoryCache.set(key, typed);
        idbSet(key, typed); // fire-and-forget

        setData(typed);
        setState('loaded');
        setQueryMs(ms);
        console.debug(`[${sectionId}] S3 query: ${ms.toFixed(0)}ms`);
      } catch (err: unknown) {
        if (abortRef.current !== requestId) return;
        setState('error');
        setError(err instanceof Error ? err.message : 'Query failed');
        console.error(`[${sectionId}] query failed:`, err);
      }
    })();
  }, [sectionId, bbox, enabled]);

  return { data, state, error, queryMs };
}
