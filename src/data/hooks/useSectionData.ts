import { useState, useEffect, useRef } from 'react';
import type { BBox } from '@/shared/types/geo';
import type { DataState, SectionId } from '@/shared/types/metrics';
import { memoryCache, cacheKey } from '@/data/cache';
import { getSectionConfig } from '@/config/sections';

interface UseSectionDataReturn<T> {
  data: T | null;
  state: DataState;
  error: string | null;
  queryMs: number | null;
}

/** Fetch section data from DuckDB with memory caching */
export function useSectionData<T>(sectionId: SectionId, bbox: BBox | null): UseSectionDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<DataState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [queryMs, setQueryMs] = useState<number | null>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!bbox) {
      setData(null);
      setState('idle');
      setError(null);
      setQueryMs(null);
      return;
    }

    const config = getSectionConfig(sectionId);
    if (!config?.query) return;

    const key = cacheKey(bbox, sectionId);

    // Check memory cache
    const cached = memoryCache.get<T>(key);
    if (cached !== undefined) {
      setData(cached);
      setState('loaded');
      setError(null);
      setQueryMs(0);
      console.debug(`[${sectionId}] cache HIT: ${key}`);
      return;
    }

    const requestId = ++abortRef.current;

    setState('loading');
    setError(null);

    const t0 = performance.now();

    config.query(bbox).then((result) => {
      if (abortRef.current !== requestId) return; // stale
      const ms = performance.now() - t0;
      const typed = result as T;
      memoryCache.set(key, typed);
      setData(typed);
      setState('loaded');
      setQueryMs(ms);
      console.debug(`[${sectionId}] query: ${ms.toFixed(0)}ms, cache MISS`);
    }).catch((err: unknown) => {
      if (abortRef.current !== requestId) return;
      setState('error');
      setError(err instanceof Error ? err.message : 'Query failed');
      console.error(`[${sectionId}] query failed:`, err);
    });
  }, [sectionId, bbox]);

  return { data, state, error, queryMs };
}
