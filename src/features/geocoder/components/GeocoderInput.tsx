import { useRef, useEffect, useCallback } from 'react';
import { useGeocoder } from '../hooks/useGeocoder';
import type { LngLat } from '@/shared/types/geo';

interface GeocoderInputProps {
  onSelect: (lngLat: LngLat, displayName?: string) => void;
}

export function GeocoderInput({ onSelect }: GeocoderInputProps): React.ReactElement {
  const { query, setQuery, results, isSearching, clear } = useGeocoder();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (lngLat: LngLat, displayName: string) => {
      onSelect(lngLat, displayName);
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
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none"
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
          placeholder="Search city or address..."
          className="w-full pl-9 pr-4 py-2.5 bg-white text-neutral-900 placeholder-neutral-400 border-2 border-neutral-900 focus:outline-none font-body text-sm"
        />
      </div>

      {showDropdown && (
        <ul className="mt-0 bg-white border-2 border-t-0 border-neutral-900 overflow-hidden">
          {isSearching && results.length === 0 && (
            <li className="px-4 py-3 font-mono text-[11px] text-neutral-400 uppercase tracking-wider">Searching...</li>
          )}
          {results.map((result, i) => (
            <li key={`${result.lngLat.lng}-${result.lngLat.lat}-${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(result.lngLat, result.displayName)}
                className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer font-body truncate"
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
