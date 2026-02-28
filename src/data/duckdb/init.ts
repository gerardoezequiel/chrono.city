import * as duckdb from '@duckdb/duckdb-wasm';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/** Number of pooled connections for parallel queries */
const POOL_SIZE = 3;
const connPool: duckdb.AsyncDuckDBConnection[] = [];
let poolReady: Promise<void> | null = null;

async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  const t0 = performance.now();
  console.log('[duckdb] initializing...');

  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  // Install extensions on a temp connection
  const setupConn = await db.connect();
  await setupConn.query(`INSTALL httpfs; LOAD httpfs;`);
  await setupConn.query(`INSTALL spatial; LOAD spatial;`);
  await setupConn.query(`SET s3_region='us-west-2';`);
  await setupConn.close();

  console.log(`[duckdb] initialized in ${(performance.now() - t0).toFixed(0)}ms`);
  return db;
}

async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = initDuckDB();
  dbInstance = await initPromise;
  return dbInstance;
}

/** Build the connection pool (call after getDuckDB) */
async function ensurePool(): Promise<void> {
  if (poolReady) return poolReady;

  poolReady = (async () => {
    const db = await getDuckDB();
    const t0 = performance.now();
    const promises: Promise<duckdb.AsyncDuckDBConnection>[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      promises.push(db.connect());
    }
    const conns = await Promise.all(promises);

    // Load extensions in each connection
    await Promise.all(conns.map(async (conn) => {
      await conn.query(`LOAD httpfs; LOAD spatial; SET s3_region='us-west-2';`);
    }));

    connPool.push(...conns);
    console.log(`[duckdb] connection pool (${POOL_SIZE}) ready in ${(performance.now() - t0).toFixed(0)}ms`);
  })();

  return poolReady;
}

/** Round-robin index for connection pool */
let rrIndex = 0;

async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  await ensurePool();
  const conn = connPool[rrIndex % connPool.length]!;
  rrIndex++;
  return conn;
}

/**
 * Eagerly start DuckDB initialization.
 * Call this on app mount so the WASM binary and extensions
 * download in parallel with the initial map render.
 */
export function warmup(): void {
  getDuckDB().then(() => ensurePool()).catch((err) => {
    console.error('[duckdb] warmup failed:', err);
  });
}

let queryCounter = 0;

export async function query<T>(sql: string): Promise<T[]> {
  const qid = ++queryCounter;
  const label = `[duckdb] query #${qid}`;
  const t0 = performance.now();
  console.log(`${label} executing...`);

  const conn = await getConnection();
  try {
    const result = await conn.query(sql);
    const rows = result.toArray().map((row) => row.toJSON() as T);
    console.log(`${label} done in ${(performance.now() - t0).toFixed(0)}ms — ${rows.length} rows`);
    return rows;
  } catch (err) {
    console.error(`${label} failed after ${(performance.now() - t0).toFixed(0)}ms:`, err);
    throw err;
  }
}

/** Check if DuckDB is initialized and pool is ready */
export function isReady(): boolean {
  return dbInstance !== null && connPool.length > 0;
}
