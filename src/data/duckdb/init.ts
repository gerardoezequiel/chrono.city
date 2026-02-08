import * as duckdb from '@duckdb/duckdb-wasm';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = initDuckDB();
  dbInstance = await initPromise;
  return dbInstance;
}

async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const conn = await db.connect();
  await conn.query(`INSTALL httpfs; LOAD httpfs;`);
  await conn.query(`INSTALL spatial; LOAD spatial;`);
  await conn.query(`SET s3_region='us-west-2';`);
  // Keep the connection open for reuse
  connInstance = conn;

  return db;
}

async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  await getDuckDB();
  if (!connInstance) {
    connInstance = await dbInstance!.connect();
  }
  return connInstance;
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
