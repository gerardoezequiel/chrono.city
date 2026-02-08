import { useRef, useEffect, useCallback } from 'react';
import { useGeocoder } from '../hooks/useGeocoder';
import type { LngLat } from '@/shared/types/geo';

interface GeocoderInputProps {
  onSelect: (lngLat: LngLat) => void;
}

export function GeocoderInput({ onSelect }: GeocoderInputProps): React.ReactElement {
  const { query, setQuery, results, isSearching, clear } = useGeocoder();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (lngLat: LngLat) => {
      onSelect(lngLat);
      clear();
    },
    [onSelect, clear],
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clear();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clear]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        clear();
        inputRef.current?.blur();
      }
    },
    [clear],
  );

  const showDropdown = results.length > 0 || isSearching;

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-80"
    >
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search city or address…"
          className="w-full pl-10 pr-4 py-2.5 bg-neutral-900/90 backdrop-blur-sm text-neutral-100 placeholder-neutral-500 rounded-xl border border-neutral-700 focus:border-indigo-500 focus:outline-none text-sm"
        />
      </div>

      {showDropdown && (
        <ul className="mt-1 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-xl overflow-hidden shadow-lg">
          {isSearching && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-400">Searching…</li>
          )}
          {results.map((result, i) => (
            <li key={`${result.lngLat.lng}-${result.lngLat.lat}-${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(result.lngLat)}
                className="w-full text-left px-4 py-2.5 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors truncate"
              >
                {result.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
