import { useState, useRef, useCallback, useEffect } from 'react';
import type { LngLat } from '@/shared/types/geo';

export interface GeocoderResult {
  displayName: string;
  lngLat: LngLat;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 300;

interface UseGeocoderReturn {
  query: string;
  setQuery: (q: string) => void;
  results: GeocoderResult[];
  isSearching: boolean;
  clear: () => void;
}

export function useGeocoder(): UseGeocoderReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocoderResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(trimmed)}&format=json&limit=5`;

      fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'chrono.city/0.1' },
      })
        .then((res) => res.json())
        .then((data: Array<{ display_name: string; lon: string; lat: string }>) => {
          setResults(
            data.map((item) => ({
              displayName: item.display_name,
              lngLat: { lng: parseFloat(item.lon), lat: parseFloat(item.lat) },
            })),
          );
          setIsSearching(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setIsSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return { query, setQuery, results, isSearching, clear };
}
