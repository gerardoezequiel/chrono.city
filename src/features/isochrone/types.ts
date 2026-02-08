export interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  edges: GraphEdge[];
}

export interface GraphEdge {
  target: string;
  cost: number; // seconds
}

export interface SegmentRow {
  id: string;
  class: string;
  connectors: SegmentConnector[];
  geojson: string;
  length_m: number;
}

export interface SegmentConnector {
  connector_id: string;
  at: number;
}

export interface ConnectorRow {
  id: string;
  lon: number;
  lat: number;
}

export interface DijkstraInput {
  nodes: Map<string, GraphNode>;
  originId: string;
  maxCostSeconds: number;
}

export interface DijkstraResult {
  reached: Map<string, number>; // nodeId → travel time seconds
}

export interface ReachedNode {
  id: string;
  lat: number;
  lon: number;
  costSeconds: number;
}
