import { create } from 'zustand';

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

interface CacheState {
  /** Memory cache hit/miss/eviction counters */
  stats: CacheStats;
  /** Estimated memory cache usage in bytes */
  memoryUsage: number;

  incrementHits: () => void;
  incrementMisses: () => void;
  incrementEvictions: () => void;
  setMemoryUsage: (bytes: number) => void;
}

export const useCacheStore = create<CacheState>((set) => ({
  stats: { hits: 0, misses: 0, evictions: 0 },
  memoryUsage: 0,

  incrementHits: () => set((s) => ({ stats: { ...s.stats, hits: s.stats.hits + 1 } })),
  incrementMisses: () => set((s) => ({ stats: { ...s.stats, misses: s.stats.misses + 1 } })),
  incrementEvictions: () => set((s) => ({ stats: { ...s.stats, evictions: s.stats.evictions + 1 } })),
  setMemoryUsage: (memoryUsage) => set({ memoryUsage }),
}));
