import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { warmup } from '@/data/duckdb/init';
import { idbPrune } from '@/data/cache/indexeddb';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/styles/index.css';

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
