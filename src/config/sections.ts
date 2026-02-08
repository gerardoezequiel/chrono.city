import type { BBox } from '@/shared/types/geo';
import type { SectionId, MetricDescriptor } from '@/shared/types/metrics';
import { queryBuildings } from '@/data/duckdb/queries/buildings.sql';
import { queryTransport } from '@/data/duckdb/queries/transport.sql';
import { queryPlaces } from '@/data/duckdb/queries/places.sql';
import { BUILDING_METRICS, NETWORK_METRICS, AMENITY_METRICS } from '@/config/metrics';

export interface SectionConfig {
  id: SectionId;
  name: string;
  description: string;
  query: ((bbox: BBox) => Promise<unknown>) | null;
  metrics: MetricDescriptor[];
}

export const SECTION_REGISTRY: SectionConfig[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Key walkability metrics at a glance',
    query: null,
    metrics: [],
  },
  {
    id: 'buildings',
    name: 'Urban Fabric',
    description: 'Morphology, density, and urban grain',
    query: (bbox: BBox) => queryBuildings(bbox) as Promise<unknown>,
    metrics: BUILDING_METRICS,
  },
  {
    id: 'network',
    name: 'Street Network',
    description: 'Connectivity, road classes, and orientation',
    query: (bbox: BBox) => queryTransport(bbox) as Promise<unknown>,
    metrics: NETWORK_METRICS,
  },
  {
    id: 'amenities',
    name: 'Amenities',
    description: '15-minute city categories and accessibility',
    query: (bbox: BBox) => queryPlaces(bbox) as Promise<unknown>,
    metrics: AMENITY_METRICS,
  },
];

export function getSectionConfig(id: SectionId): SectionConfig | undefined {
  return SECTION_REGISTRY.find((s) => s.id === id);
}
