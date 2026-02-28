import { useMemo, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLat, BBox, StudyAreaMode } from '@/shared/types/geo';
import type { SectionId } from '@/shared/types/metrics';
import type { ReverseResult } from '@/features/geocoder';
import { useSectionData } from '@/data/hooks/useSectionData';
import { originToBbox } from '@/data/cache/bbox-quantize';
import { getSectionConfig } from '@/config/sections';
import { SECTION_NARRATIVES } from '@/config/narratives';
import { LocationBar } from './LocationBar';
import { SectionShell } from './SectionShell';
import { ChronoScore } from './ChronoScore';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { useMapLayerSync } from '../hooks/useMapLayerSync';

type IsochroneStatus = 'idle' | 'fetching' | 'done' | 'error';

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
}

const MODES: { value: StudyAreaMode; label: string }[] = [
  { value: 'ring', label: 'Pedshed' },
  { value: 'isochrone', label: 'Isochrone' },
];

export function Sidebar({ origin, reverseResult, status, error, mode, onModeChange, customMinutes, onCustomMinutesChange, onClear, geocoder, onGeocoderSelect, map }: SidebarProps): React.ReactElement {
  const isCustom = customMinutes != null;
  const bbox = useMemo(() => origin ? originToBbox(origin) : null, [origin]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSection = useScrollSpy(scrollRef);

  // Sync map layers with scroll position
  useMapLayerSync(map, activeSection);

  return (
    <aside className="fixed top-0 left-0 w-[400px] h-dvh z-50 flex flex-col bg-white border-r-2 border-neutral-900">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 border-b-2 border-neutral-900 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg font-bold uppercase tracking-tight text-neutral-900">chrono.city</h1>
          <div className="flex items-center gap-2">
            {origin && <StatusBadge status={status} />}
            {origin && (
              <button
                onClick={onClear}
                className="font-mono text-[10px] font-medium px-2 py-1 text-neutral-500 border border-neutral-300 hover:border-neutral-900 hover:text-neutral-900 transition-colors cursor-pointer uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="font-mono text-[10px] text-neutral-400 mt-1 uppercase tracking-widest">Anatomy of proximity</p>
      </header>

      {/* Location bar */}
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

      {/* Mode toggle + walk time */}
      <div className="px-6 py-3 border-b-2 border-neutral-200 shrink-0 flex flex-col gap-3">
        <div className="flex gap-0">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 font-heading text-[11px] font-semibold uppercase tracking-wider py-2 transition-all cursor-pointer border-2 ${
                mode === value
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400 hover:text-neutral-600'
              } ${value === 'ring' ? 'border-r-0' : ''}`}
            >
              {value === 'isochrone' ? <IsochroneIcon /> : <PedshedIcon />}
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-neutral-400 shrink-0 uppercase tracking-wider">Walk</span>
          {!isCustom ? (
            <>
              <span className="font-mono text-[12px] font-medium text-neutral-900 tracking-tight">5 · 10 · 15 min</span>
              <button
                onClick={() => onCustomMinutesChange(10)}
                className="ml-auto font-mono text-[10px] text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer font-medium uppercase tracking-wider border-b border-neutral-300 hover:border-neutral-900"
              >
                Custom
              </button>
            </>
          ) : (
            <>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={customMinutes}
                onChange={(e) => onCustomMinutesChange(Number(e.target.value))}
                className="flex-1 h-0.5 bg-neutral-300 appearance-none cursor-pointer accent-neutral-900 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-neutral-900 [&::-webkit-slider-thumb]:appearance-none"
              />
              <span className="font-mono text-[12px] font-bold text-neutral-900 tabular-nums w-12 text-right shrink-0">
                {customMinutes} min
              </span>
              <button
                onClick={() => onCustomMinutesChange(null)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                title="Reset to 5 · 10 · 15"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable sections */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {origin && bbox ? (
          <div className="flex flex-col">
            <OverviewSection />
            <DataSection sectionId="buildings" bbox={bbox} />
            <DataSection sectionId="network" bbox={bbox} />
            <DataSection sectionId="amenities" bbox={bbox} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div className="w-14 h-14 border-2 border-neutral-200 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-heading text-base font-bold text-neutral-900 uppercase tracking-tight">Select a location</p>
            <p className="font-mono text-[10px] text-neutral-400 mt-2 leading-relaxed uppercase tracking-wider">
              Search above or click the map
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-neutral-50 border-t-2 border-neutral-900 shrink-0">
          <p className="font-mono text-[11px] text-neutral-900">{error}</p>
        </div>
      )}
    </aside>
  );
}

// ─── Overview section with progressive Chrono Score ──────────

function OverviewSection(): React.ReactElement {
  const narrative = SECTION_NARRATIVES.overview;

  return (
    <div data-section-id="overview">
      <ChronoScore
        chapters={[
          { label: 'Fabric', score: null, weight: 0.25 },
          { label: 'Resilience', score: null, weight: 0.20 },
          { label: 'Vitality', score: null, weight: 0.30 },
          { label: 'Connectivity', score: null, weight: 0.25 },
        ]}
      />
      <div className="px-6 pb-3">
        <p className="font-mono text-[11px] text-neutral-500 leading-relaxed">
          {narrative.intro}
        </p>
        <p className="font-mono text-[10px] text-neutral-400 mt-2 italic leading-relaxed">
          {narrative.mapHint}
        </p>
      </div>
    </div>
  );
}

// ─── Data-driven section with three-phase reveal ─────────────

function DataSection({ sectionId, bbox }: { sectionId: SectionId; bbox: BBox }): React.ReactElement {
  const config = getSectionConfig(sectionId);
  const { data, state, error, queryMs } = useSectionData(sectionId, bbox);
  const narrative = SECTION_NARRATIVES[sectionId as keyof typeof SECTION_NARRATIVES];

  if (!config) return <></>;

  return (
    <div data-section-id={sectionId}>
      <SectionShell
        title={config.name}
        description={config.description}
        state={state}
        error={error}
        descriptors={config.metrics}
        data={data as Record<string, unknown> | null}
        queryMs={queryMs}
        narrative={narrative?.intro}
        mapHint={narrative?.mapHint}
      />
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────

function IsochroneIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M8 5.5C7 5.3 6 6 5.8 7C5.6 8 6.3 8.8 7 9.3C7.7 9.8 8.5 10 9.2 9.5C10 9 10.5 8 10.3 7C10.1 6 9 5.7 8 5.5Z"
        stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 3.5C5.8 3.2 3.8 4.5 3.4 6.5C3 8.5 4 10 5.3 11C6.5 12 8.2 12.5 9.8 11.5C11.3 10.5 12.5 8.8 12.2 6.8C11.9 4.8 10.2 3.8 8 3.5Z"
        stroke="currentColor" strokeWidth="0.9" />
      <path d="M8 1.5C4.8 1.1 2 3 1.5 5.8C1 8.6 2.3 10.8 4 12.2C5.7 13.6 8 14.2 10.2 13C12.5 11.8 14.2 9.2 13.8 6.2C13.4 3.2 11.2 1.9 8 1.5Z"
        stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function PedshedIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.5 1.5" />
      <circle cx="8" cy="8" r="6.8" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2.5 1.5" />
    </svg>
  );
}

function StatusBadge({ status }: { status: IsochroneStatus }): React.ReactElement | null {
  if (status === 'idle') return null;

  if (status === 'fetching') {
    return (
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-neutral-100 text-neutral-900 border border-neutral-300">
        Computing
      </span>
    );
  }

  if (status === 'done') {
    return (
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-neutral-900 text-white">
        Ready
      </span>
    );
  }

  return (
    <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-white text-neutral-900 border-2 border-neutral-900">
      Error
    </span>
  );
}
