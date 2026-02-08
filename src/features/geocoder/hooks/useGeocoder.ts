import { useState, useRef, useCallback, useEffect } from 'react';
import type { LngLat } from '@/shared/types/geo';

export interface GeocoderResult {
  displayName: string;
  lngLat: LngLat;
}

const PHOTON_URL = 'https://photon.komoot.io/api';
const DEBOUNCE_MS = 300;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
  };
}

function formatPhotonResult(props: PhotonFeature['properties']): string {
  const parts: string[] = [];
  if (props.name) parts.push(props.name);
  if (props.street) {
    const street = props.housenumber ? `${props.street} ${props.housenumber}` : props.street;
    if (street !== props.name) parts.push(street);
  }
  if (props.city && props.city !== props.name) parts.push(props.city);
  if (props.state) parts.push(props.state);
  if (props.country) parts.push(props.country);
  return parts.join(', ') || 'Unknown';
}

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

      const url = `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}&limit=5&lang=en`;

      fetch(url, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { features: PhotonFeature[] }) => {
          setResults(
            data.features.map((f) => ({
              displayName: formatPhotonResult(f.properties),
              lngLat: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
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
