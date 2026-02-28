import { useState, useRef, useEffect, useCallback } from 'react';
import type { LngLat } from '@/shared/types/geo';
import type { ReverseResult } from '@/features/geocoder';

interface SearchResult {
  displayName: string;
  lngLat: LngLat;
}

interface LocationBarProps {
  origin: LngLat | null;
  reverseResult: ReverseResult | null;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  onSelect: (lngLat: LngLat, displayName: string) => void;
  onClearSearch: () => void;
}

export function LocationBar({
  origin,
  reverseResult,
  query,
  onQueryChange,
  results,
  isSearching,
  onSelect,
  onClearSearch,
}: LocationBarProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    if (!origin) setIsEditing(false);
  }, [origin]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelect(result.lngLat, result.displayName);
      setIsEditing(false);
      onClearSearch();
    },
    [onSelect, onClearSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (origin) setIsEditing(false);
        onClearSearch();
        inputRef.current?.blur();
      }
    },
    [origin, onClearSearch],
  );

  const showSearch = !origin || isEditing;
  const showDropdown = showSearch && (results.length > 0 || isSearching);

  return (
    <div className="relative shrink-0">
      {showSearch ? (
        <div className="px-4 md:px-6 py-3 bg-neutral-50 border-b border-neutral-200">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-3.5 md:h-3.5 text-neutral-400 pointer-events-none"
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
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search city or address..."
              autoFocus={!origin}
              className="w-full pl-10 md:pl-9 pr-10 md:pr-8 py-3 md:py-2 bg-white text-neutral-900 placeholder-neutral-400 border-2 border-neutral-200 focus:border-neutral-900 focus:outline-none font-body text-base md:text-sm"
            />
            {origin && (
              <button
                onClick={() => { setIsEditing(false); onClearSearch(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 active:text-neutral-900 transition-colors cursor-pointer p-1"
              >
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {showDropdown && (
            <ul className="absolute left-4 right-4 mt-1 bg-white border-2 border-neutral-900 overflow-hidden z-10 max-h-60 overflow-y-auto">
              {isSearching && results.length === 0 && (
                <li className="px-4 py-3 font-mono text-[13px] md:text-[11px] text-neutral-400 uppercase tracking-wider">Searching...</li>
              )}
              {results.map((result, i) => (
                <li key={`${result.lngLat.lng}-${result.lngLat.lat}-${i}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="w-full text-left px-4 py-3.5 md:py-2.5 text-base md:text-sm text-neutral-700 hover:bg-neutral-900 hover:text-white active:bg-neutral-900 active:text-white transition-colors cursor-pointer font-body"
                  >
                    <span className="block truncate">{result.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full text-left group cursor-pointer border-b-2 border-neutral-200 hover:border-neutral-900 active:border-neutral-900 transition-colors"
        >
          <div className="px-4 md:px-6 py-4">
            {reverseResult ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-[15px] font-bold text-neutral-900 uppercase tracking-tight truncate leading-tight">
                    {reverseResult.street}
                  </p>
                  {reverseResult.city && reverseResult.city !== reverseResult.street && (
                    <p className="font-mono text-[13px] md:text-[11px] text-neutral-500 uppercase tracking-wider mt-0.5 truncate">
                      {reverseResult.city}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 md:w-3.5 md:h-3.5 text-neutral-300 group-hover:text-neutral-900 transition-colors shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-mono text-[13px] md:text-[11px] text-neutral-400 animate-pulse uppercase tracking-wider">Locating...</p>
                <svg className="w-4 h-4 md:w-3.5 md:h-3.5 text-neutral-300 group-hover:text-neutral-900 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}
            {origin && (
              <p className="font-mono text-[11px] md:text-[9px] text-red-600/50 tabular-nums mt-1.5 tracking-wider">
                {origin.lat.toFixed(5)}N {origin.lng >= 0 ? '' : '−'}{Math.abs(origin.lng).toFixed(5)}{origin.lng >= 0 ? 'E' : 'W'}
              </p>
            )}
          </div>
        </button>
      )}
    </div>
  );
}
