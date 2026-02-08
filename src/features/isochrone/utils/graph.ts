import { WALK_SPEEDS, DEFAULT_WALK_SPEED } from '@/config/constants';
import type { GraphNode, ConnectorRow } from '../types';

interface RawSegment {
  id: string;
  class: string;
  connectors: unknown;
  length_m: number;
}

interface ParsedConnector {
  connector_id: string;
  at: number;
}

/** Convert Arrow Vector or plain array to JS array */
function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  // DuckDB-WASM returns Arrow Vectors with toJSON() or toArray()
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj['toJSON'] === 'function') return obj['toJSON']() as unknown[];
    if (typeof obj['toArray'] === 'function') return Array.from(obj['toArray']() as Iterable<unknown>);
    // Iterable (Symbol.iterator)
    if (Symbol.iterator in obj) return Array.from(obj as Iterable<unknown>);
  }
  return [];
}

/** Parse the connectors column from DuckDB-WASM (Arrow Vector of structs) */
function parseConnectors(raw: unknown): ParsedConnector[] {
  const arr = toArray(raw);
  if (arr.length === 0) return [];

  return arr.map((c) => {
    if (!c || typeof c !== 'object') return null;
    const obj = c as Record<string, unknown>;
    // DuckDB may return as {connector_id, at} or via toJSON()
    const entry = typeof obj['toJSON'] === 'function'
      ? (obj['toJSON']() as Record<string, unknown>)
      : obj;
    return {
      connector_id: String(entry['connector_id'] ?? ''),
      at: Number(entry['at'] ?? 0),
    };
  }).filter((c): c is ParsedConnector => c !== null && c.connector_id !== '');
}

export function buildGraph(
  segments: RawSegment[],
  connectors: ConnectorRow[],
): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  for (const c of connectors) {
    graph.set(c.id, { id: c.id, lat: c.lat, lon: c.lon, edges: [] });
  }

  let edgeCount = 0;
  for (const seg of segments) {
    const speed = WALK_SPEEDS[seg.class] ?? DEFAULT_WALK_SPEED;
    if (speed <= 0) continue;

    const conns = parseConnectors(seg.connectors);
    if (conns.length < 2) continue;

    const totalLength = seg.length_m;

    for (let i = 0; i < conns.length - 1; i++) {
      const from = conns[i];
      const to = conns[i + 1];
      if (!from || !to) continue;

      const fromNode = graph.get(from.connector_id);
      const toNode = graph.get(to.connector_id);
      if (!fromNode || !toNode) continue;

      const fraction = Math.abs(to.at - from.at);
      const edgeLength = totalLength * fraction;
      const cost = edgeLength / speed;

      fromNode.edges.push({ target: to.connector_id, cost });
      toNode.edges.push({ target: from.connector_id, cost });
      edgeCount++;
    }
  }

  console.log(`[graph] ${graph.size} nodes, ${edgeCount} edges`);
  return graph;
}

/** Find the nearest graph node to a given point */
export function findNearestNode(
  graph: Map<string, GraphNode>,
  lat: number,
  lon: number,
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const [id, node] of graph) {
    const dlat = node.lat - lat;
    const dlon = node.lon - lon;
    const dist = dlat * dlat + dlon * dlon;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  return bestId;
}
