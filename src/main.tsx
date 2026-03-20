import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { warmup } from '@/data/duckdb/init';
import { seedPreloadSync } from '@/data/preload';
import { idbPrune } from '@/data/cache/indexeddb';
import londonBundle from '@/data/preload/london.json';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/styles/index.css';

// Seed memory cache BEFORE React renders — useSectionData
// will find preloaded data on first synchronous cache check.
// This must happen before createRoot().render() so sections
// never see an empty cache for pre-extracted cities.
seedPreloadSync(londonBundle);

// Start DuckDB WASM download + extension install immediately,
// in parallel with React mount and map tile loading
warmup();

// Clean expired IndexedDB entries in background
idbPrune();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
