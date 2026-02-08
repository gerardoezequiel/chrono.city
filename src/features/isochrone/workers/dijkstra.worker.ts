import type { GraphNode } from '../types';

interface WorkerInput {
  nodes: [string, GraphNode][];
  originId: string;
  maxCostSeconds: number;
}

interface WorkerOutput {
  reached: [string, number][];
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { nodes, originId, maxCostSeconds } = e.data;
  const graph = new Map(nodes);

  const dist = new Map<string, number>();
  const pq: [number, string][] = [[0, originId]];
  dist.set(originId, 0);

  while (pq.length > 0) {
    // Pop minimum — simple sort for small graphs (~2k nodes)
    pq.sort((a, b) => a[0] - b[0]);
    const entry = pq.shift()!;
    const cost = entry[0];
    const nodeId = entry[1];

    if (cost > maxCostSeconds) continue;
    if (cost > (dist.get(nodeId) ?? Infinity)) continue;

    const node = graph.get(nodeId);
    if (!node) continue;

    for (const edge of node.edges) {
      const newCost = cost + edge.cost;
      if (newCost <= maxCostSeconds && newCost < (dist.get(edge.target) ?? Infinity)) {
        dist.set(edge.target, newCost);
        pq.push([newCost, edge.target]);
      }
    }
  }

  const result: WorkerOutput = {
    reached: Array.from(dist.entries()),
  };

  self.postMessage(result);
};
