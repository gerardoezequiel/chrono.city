import { useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat, StudyAreaMode } from '@/shared/types/geo';
import type { DataState } from '@/shared/types/metrics';
import type { KonturH3Properties } from '@/shared/types/kontur';
import type { ReverseResult } from '@/features/geocoder';
import type { ChronoScore } from '@/data/scoring/types';
import type { MapPreviews } from '@/features/map';
import { LocationBar } from './LocationBar';
import { SectionList } from './SectionList';
import { ModeControls } from './ModeControls';
import { StatusBadge } from './StatusBadge';
import type { IsochroneStatus } from './StatusBadge';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { useMapLayerSync } from '../hooks/useMapLayerSync';

interface SearchResult {
  displayName: string;
  lngLat: LngLat;
}

interface GeocoderState {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  clear: () => void;
}

interface SidebarProps {
  origin: LngLat | null;
  reverseResult: ReverseResult | null;
  status: IsochroneStatus;
  error: string | null;
  mode: StudyAreaMode;
  onModeChange: (mode: StudyAreaMode) => void;
  customMinutes: number | null;
  onCustomMinutesChange: (value: number | null) => void;
  onClear: () => void;
  geocoder: GeocoderState;
  onGeocoderSelect: (lngLat: LngLat, displayName: string) => void;
  map: maplibregl.Map | null;
  konturCell: KonturH3Properties | null;
  konturState: DataState;
  chronoScore: ChronoScore | null;
  isDragging: boolean;
  previews: MapPreviews;
  isMobile?: boolean;
}

export function Sidebar({ origin, reverseResult, status, error, mode, onModeChange, customMinutes, onCustomMinutesChange, onClear, geocoder, onGeocoderSelect, map, konturCell, konturState, chronoScore, isDragging, previews, isMobile }: SidebarProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSection = useScrollSpy(scrollRef);

  useMapLayerSync(map, activeSection);

  const asideClass = isMobile
    ? 'flex flex-col bg-white w-full'
    : 'fixed top-0 left-0 w-[400px] h-dvh z-50 flex flex-col bg-white border-r-2 border-neutral-900';

  return (
    <aside className={asideClass}>
      {/* Header */}
      <header className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b-2 border-neutral-900 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-base md:text-lg font-bold uppercase tracking-tight text-neutral-900">chrono.city</h1>
          <div className="flex items-center gap-2">
            {origin && <StatusBadge status={status} />}
            {origin && (
              <button
                onClick={onClear}
                className="font-mono text-[11px] md:text-[10px] font-medium px-2.5 py-1.5 md:px-2 md:py-1 text-neutral-500 border border-neutral-300 hover:border-neutral-900 hover:text-neutral-900 active:bg-neutral-900 active:text-white transition-colors cursor-pointer uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="font-mono text-[12px] md:text-[10px] text-neutral-400 mt-1 uppercase tracking-widest">Anatomy of proximity</p>
      </header>

      <LocationBar
        origin={origin}
        reverseResult={reverseResult}
        query={geocoder.query}
        onQueryChange={geocoder.setQuery}
        results={geocoder.results}
        isSearching={geocoder.isSearching}
        onSelect={onGeocoderSelect}
        onClearSearch={geocoder.clear}
      />

      <ModeControls
        mode={mode}
        onModeChange={onModeChange}
        customMinutes={customMinutes}
        onCustomMinutesChange={onCustomMinutesChange}
      />

      {/* Scrollable sections */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {origin ? (
          <SectionList
            origin={origin}
            konturCell={konturCell}
            konturState={konturState}
            chronoScore={chronoScore}
            activeSection={activeSection}
            isDragging={isDragging}
            previews={previews}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div className="w-14 h-14 border-2 border-neutral-200 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-heading text-base font-bold text-neutral-900 uppercase tracking-tight">Select a location</p>
            <p className="font-mono text-[12px] md:text-[10px] text-neutral-400 mt-2 leading-relaxed uppercase tracking-wider">
              Search above or tap the map
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="px-6 py-3 bg-neutral-50 border-t-2 border-neutral-900 shrink-0">
          <p className="font-mono text-[11px] text-neutral-900">{error}</p>
        </div>
      )}
    </aside>
  );
}
