import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { PMTILES_URLS, MAP_DEFAULTS } from '@/config/constants';
import type { LngLat } from '@/shared/types/geo';

interface MapContainerProps {
  onMapReady: (map: maplibregl.Map) => void;
  onMapClick: (lngLat: LngLat) => void;
  is3D?: boolean;
}

let protocolAdded = false;

export function MapContainer({ onMapReady, onMapClick, is3D = false }: MapContainerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!protocolAdded) {
      const protocol = new Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      protocolAdded = true;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      minZoom: MAP_DEFAULTS.minZoom,
      maxZoom: MAP_DEFAULTS.maxZoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      onMapReady(map);
    });

    map.on('click', (e) => {
      onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle 2D ↔ 3D
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = (): void => {
      if (is3D) {
        map.setLayoutProperty('buildings-fill', 'visibility', 'none');
        map.setLayoutProperty('buildings-outline', 'visibility', 'none');
        map.setLayoutProperty('buildings-3d', 'visibility', 'visible');
        map.easeTo({ pitch: 60, duration: 600 });
      } else {
        map.setLayoutProperty('buildings-fill', 'visibility', 'visible');
        map.setLayoutProperty('buildings-outline', 'visibility', 'visible');
        map.setLayoutProperty('buildings-3d', 'visibility', 'none');
        map.easeTo({ pitch: 0, duration: 600 });
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      const onIdle = (): void => { apply(); map.off('idle', onIdle); };
      map.on('idle', onIdle);
      return () => { map.off('idle', onIdle); };
    }
  }, [is3D]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      buildings: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URLS.buildings}`,
      },
      transportation: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URLS.transportation}`,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0a0a0f' },
      },
      {
        id: 'buildings-fill',
        type: 'fill',
        source: 'buildings',
        'source-layer': 'building',
        paint: {
          'fill-color': '#2d2d52',
          'fill-opacity': 0.9,
        },
      },
      {
        id: 'buildings-outline',
        type: 'line',
        source: 'buildings',
        'source-layer': 'building',
        paint: {
          'line-color': '#4a4a7a',
          'line-width': 0.5,
        },
      },
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'buildings',
        'source-layer': 'building',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'height'], ['*', ['coalesce', ['get', 'num_floors'], 2], 3.5]],
            0, '#2d2d52',
            15, '#3d3d6e',
            40, '#5555a0',
            100, '#7777cc',
          ],
          'fill-extrusion-height': [
            'coalesce',
            ['get', 'height'],
            ['*', ['coalesce', ['get', 'num_floors'], 2], 3.5],
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.95,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'transportation',
        'source-layer': 'segment',
        filter: ['==', ['get', 'subtype'], 'road'],
        paint: {
          'line-color': '#3a3a5e',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            10, 0.5,
            14, 1.5,
            18, 3,
          ],
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'transportation',
        'source-layer': 'segment',
        filter: [
          'all',
          ['==', ['get', 'subtype'], 'road'],
          ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary']]],
        ],
        paint: {
          'line-color': '#5555a0',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            10, 1,
            14, 2.5,
            18, 5,
          ],
        },
      },
    ],
  };
}
