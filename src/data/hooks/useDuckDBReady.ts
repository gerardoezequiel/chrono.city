import { useState, useEffect } from 'react';
import { isReady, readyPromise } from '@/data/duckdb/init';

/** Returns true once DuckDB-WASM + connection pool is initialized */
export function useDuckDBReady(): boolean {
  const [ready, setReady] = useState(isReady);

  useEffect(() => {
    if (ready) return;
    readyPromise.then(() => setReady(true)).catch(() => {});
  }, [ready]);

  return ready;
}
