import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { SectionId } from '@/shared/types/metrics';
import { getSectionConfig, getAllSectionLayerIds } from '@/config/sections';

/**
 * Syncs map layer visibility and emphasis with the active sidebar section.
 * - Turns on layers owned by the active section
 * - Turns off layers owned by other sections
 * - Adjusts building opacity when buildings section is active
 */
export function useMapLayerSync(
  map: maplibregl.Map | null,
  activeSection: SectionId,
): void {
  const prevRef = useRef<SectionId | null>(null);

  useEffect(() => {
    if (!map || activeSection === prevRef.current) return;
    prevRef.current = activeSection;

    const trySync = (): void => {
      const allToggleLayers = getAllSectionLayerIds();
      const activeConfig = getSectionConfig(activeSection);

      // Hide all section-owned layers
      for (const layerId of allToggleLayers) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }

      // Show layers for active section
      if (activeConfig) {
        for (const layerId of activeConfig.layers.show) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'visible');
          }
        }
      }

      // Emphasize buildings when buildings section active
      const buildingsActive = activeSection === 'buildings';
      if (map.getLayer('buildings-fill')) {
        map.setPaintProperty('buildings-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'inside'], false],
          buildingsActive ? 0.85 : 0.7,
          buildingsActive ? 0.75 : 0.6,
        ]);
      }
    };

    if (map.isStyleLoaded()) {
      trySync();
    } else {
      const handler = (): void => { trySync(); map.off('idle', handler); };
      map.on('idle', handler);
    }
  }, [map, activeSection]);
}
