import type { BuildingMetrics } from '@/shared/types/metrics';
import type { FabricIndicators } from '@/data/scoring/types';
import { scoreFabric } from '@/data/scoring/chapters/fabric';
import type { CoreRow, SubtypeRow, FootprintRow } from './buildings-types';

export function deriveBuildingMetrics(
  r: CoreRow,
  subtypeRows: SubtypeRow[],
  footprintRows: FootprintRow[],
): BuildingMetrics {
  const totalFootprint = Number(r.total_footprint_area_m2);
  const totalFloorArea = Number(r.total_floor_area_m2);
  const viewportArea = Number(r.viewport_area_m2);
  const buildingCount = Number(r.building_count);
  const buildingsWithHeight = Number(r.buildings_with_height);
  const heightCoverage = buildingCount > 0 ? buildingsWithHeight / buildingCount : 0;
  const gsi = viewportArea > 0 ? totalFootprint / viewportArea : 0;
  const fsi = buildingsWithHeight > 0 && viewportArea > 0 ? totalFloorArea / viewportArea : null;
  const osr = fsi != null && fsi > 0 ? (1 - gsi) / fsi : null;

  const subtypeDistribution: Record<string, number> = {};
  for (const row of subtypeRows) {
    subtypeDistribution[row.subtype] = Number(row.count);
  }

  const footprintDistribution = footprintRows.map((row) => Number(row.area_m2));

  const fabricIndicators: FabricIndicators = {
    gsi,
    fsi: fsi ?? 0,
    osr: osr ?? 0,
    compactness: Number(r.avg_compactness),
    urbanGrain: Number(r.median_footprint_area_m2),
    fractalDimension: r.fractal_dimension != null ? Number(r.fractal_dimension) : null,
    buildingCount,
    avgHeight: r.avg_height_m != null ? Number(r.avg_height_m) : null,
    heightCoverage,
    earliestConstructionYear: null,
    latestConstructionYear: null,
    recentOsmBuildings: null,
  };

  return {
    buildingCount,
    totalFootprintAreaM2: totalFootprint,
    avgFootprintAreaM2: Number(r.avg_footprint_area_m2),
    buildingsWithHeight,
    avgHeightM: r.avg_height_m != null ? Number(r.avg_height_m) : null,
    avgFloors: r.avg_floors != null ? Number(r.avg_floors) : null,
    heightCoverage,
    viewportAreaM2: viewportArea,
    gsi,
    fsi,
    osr,
    compactness: Number(r.avg_compactness),
    urbanGrain: Number(r.median_footprint_area_m2),
    fractalDimension: r.fractal_dimension != null ? Number(r.fractal_dimension) : null,
    fabricScore: scoreFabric(fabricIndicators).score,
    footprintDistribution,
    subtypeDistribution,
  };
}
