import type { BBox } from '@/shared/types/geo';
import type { SectionId, MetricDescriptor } from '@/shared/types/metrics';
import type { ChartBinding } from '@/features/charts/types';
import { queryBuildings } from '@/data/duckdb/queries/buildings.sql';
import { queryTransport } from '@/data/duckdb/queries/transport.sql';
import { queryPlaces } from '@/data/duckdb/queries/places.sql';
import { OVERVIEW_METRICS, BUILDING_METRICS, NETWORK_METRICS, AMENITY_METRICS } from '@/config/metrics';
import { OVERVIEW_CHARTS, BUILDING_CHARTS, NETWORK_CHARTS, AMENITY_CHARTS } from '@/config/charts';

/** Map layer IDs that should highlight when this section is active */
export interface SectionLayers {
  /** Layer IDs to make visible when active */
  show: string[];
  /** Layer IDs whose opacity should be boosted when active */
  emphasize: string[];
}

export interface SectionConfig {
  id: SectionId;
  name: string;
  description: string;
  query: ((bbox: BBox) => Promise<unknown>) | null;
  metrics: MetricDescriptor[];
  charts: ChartBinding[];
  /** Map layers controlled by this section's scroll position */
  layers: SectionLayers;
}

export const SECTION_REGISTRY: SectionConfig[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Key walkability metrics at a glance',
    query: null,
    metrics: OVERVIEW_METRICS,
    charts: OVERVIEW_CHARTS,
    layers: { show: [], emphasize: [] },
  },
  {
    id: 'buildings',
    name: 'Urban Fabric',
    description: 'Morphology, density, and urban grain',
    query: (bbox: BBox) => queryBuildings(bbox) as Promise<unknown>,
    metrics: BUILDING_METRICS,
    charts: BUILDING_CHARTS,
    layers: {
      show: [],
      emphasize: ['buildings-fill', 'buildings-outline'],
    },
  },
  {
    id: 'network',
    name: 'Street Network',
    description: 'Connectivity, road classes, and orientation',
    query: (bbox: BBox) => queryTransport(bbox) as Promise<unknown>,
    metrics: NETWORK_METRICS,
    charts: NETWORK_CHARTS,
    layers: {
      show: ['roads-overlay'],
      emphasize: [],
    },
  },
  {
    id: 'amenities',
    name: 'Amenities',
    description: '15-minute city categories and accessibility',
    query: (bbox: BBox) => queryPlaces(bbox) as Promise<unknown>,
    metrics: AMENITY_METRICS,
    charts: AMENITY_CHARTS,
    layers: {
      show: ['places-dots'],
      emphasize: [],
    },
  },
];

export function getSectionConfig(id: SectionId): SectionConfig | undefined {
  return SECTION_REGISTRY.find((s) => s.id === id);
}

/** Get all unique layer IDs across all sections */
export function getAllSectionLayerIds(): string[] {
  const ids = new Set<string>();
  for (const section of SECTION_REGISTRY) {
    for (const id of section.layers.show) ids.add(id);
  }
  return [...ids];
}
