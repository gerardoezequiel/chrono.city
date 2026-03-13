import { S3_PATHS } from '@/config/constants';
import type { BBox } from '@/shared/types/geo';
import { query } from '@/data/duckdb/init';

const BBOX_PRED = (b: BBox): string =>
  `bbox.xmin <= ${b.east} AND bbox.xmax >= ${b.west} AND bbox.ymin <= ${b.north} AND bbox.ymax >= ${b.south}`;

interface ConnectorDegreeRow {
  connector_id: string;
  degree: number;
}

interface ActiveTransportRow {
  is_active: boolean;
  total_length_m: number;
}

export interface AdvancedNetworkMetrics {
  /** Intersections (3+ way) per km² */
  intersectionDensity: number;
  /** Total intersection count (degree >= 3) */
  intersectionCount: number;
  /** Dead-end ratio: degree-1 nodes / total nodes */
  deadEndRatio: number;
  /** Footway + cycleway length / total road length */
  activeTransportShare: number;
  /** Beta index: edges / nodes — higher = more connected */
  betaIndex: number;
  /** Gamma index: edges / max possible edges in planar graph (0–1) */
  gammaIndex: number;
}

/**
 * Compute advanced network connectivity metrics from Overture transport data.
 * Requires two queries: connector degree analysis + active transport share.
 */
export async function queryAdvancedNetwork(bbox: BBox): Promise<AdvancedNetworkMetrics> {
  // Estimate study area in km² from bbox
  const latMid = (bbox.north + bbox.south) / 2;
  const dLat = (bbox.north - bbox.south) * 111.139;
  const dLng = (bbox.east - bbox.west) * 111.139 * Math.cos(latMid * Math.PI / 180);
  const areaKm2 = Math.max(dLat * dLng, 0.01);

  // Query 1: Connector degree — how many segments meet at each connector
  // Unnest the connectors array from segments, count occurrences per connector
  const degreeSql = `
    WITH segment_connectors AS (
      SELECT UNNEST(connectors) AS connector_id
      FROM read_parquet('${S3_PATHS.segments}', hive_partitioning=1)
      WHERE ${BBOX_PRED(bbox)}
        AND subtype = 'road'
    )
    SELECT
      connector_id,
      COUNT(*) AS degree
    FROM segment_connectors
    GROUP BY connector_id
  `;

  // Query 2: Active transport share — footway + cycleway vs total
  const activeSql = `
    SELECT
      class IN ('footway', 'pedestrian', 'path', 'cycleway', 'steps') AS is_active,
      SUM(ST_Length_Spheroid(geometry)) AS total_length_m
    FROM read_parquet('${S3_PATHS.segments}', hive_partitioning=1)
    WHERE ${BBOX_PRED(bbox)}
      AND subtype = 'road'
    GROUP BY is_active
  `;

  const [degreeRows, activeRows] = await Promise.all([
    query<ConnectorDegreeRow>(degreeSql),
    query<ActiveTransportRow>(activeSql),
  ]);

  // Compute intersection metrics from connector degrees
  let intersectionCount = 0;
  let deadEndCount = 0;
  const totalNodes = degreeRows.length;

  for (const row of degreeRows) {
    const d = Number(row.degree);
    if (d >= 3) intersectionCount++;
    if (d === 1) deadEndCount++;
  }

  const intersectionDensity = areaKm2 > 0 ? intersectionCount / areaKm2 : 0;
  const deadEndRatio = totalNodes > 0 ? deadEndCount / totalNodes : 0;

  // Compute active transport share
  let activeLength = 0;
  let totalLength = 0;
  for (const row of activeRows) {
    const len = Number(row.total_length_m);
    totalLength += len;
    if (row.is_active) activeLength += len;
  }
  const activeTransportShare = totalLength > 0 ? activeLength / totalLength : 0;

  // Connectivity indices from graph topology
  // Total edges = sum of all degrees / 2 (each edge connects two nodes)
  let totalDegree = 0;
  for (const row of degreeRows) {
    totalDegree += Number(row.degree);
  }
  const totalEdges = totalDegree / 2;

  // Beta index: E / V — values >1 indicate a connected network
  const betaIndex = totalNodes > 0 ? totalEdges / totalNodes : 0;
  // Gamma index: E / E_max — for planar graphs, E_max = 3*(V-2)
  const maxEdges = totalNodes > 2 ? 3 * (totalNodes - 2) : 1;
  const gammaIndex = totalEdges / maxEdges;

  return {
    intersectionDensity,
    intersectionCount,
    deadEndRatio,
    activeTransportShare,
    betaIndex,
    gammaIndex,
  };
}
