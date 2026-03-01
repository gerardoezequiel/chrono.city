import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { PMTILES_URLS, MAP_DEFAULTS } from '@/config/constants';
import { KONTUR_TILE_URL, KONTUR_MAX_ZOOM } from '@/config/kontur';
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
      attributionControl: false,
    });

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
        map.setSky({
          'atmosphere-blend': 0.5,
          'sky-color': '#e0e0e0',
          'horizon-color': '#f5f5f5',
          'fog-color': '#fafafa',
          'fog-ground-blend': 0.8,
          'horizon-fog-blend': 0.5,
        });
        map.easeTo({ pitch: 60, duration: 600 });
      } else {
        map.setLayoutProperty('buildings-fill', 'visibility', 'visible');
        map.setLayoutProperty('buildings-outline', 'visibility', 'visible');
        map.setLayoutProperty('buildings-3d', 'visibility', 'none');
        map.setSky({ 'atmosphere-blend': 0 });
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
      carto: {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
      'carto-labels': {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
      },
      buildings: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URLS.buildings}`,
        promoteId: 'id',
        maxzoom: 14,
      },
      transportation: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URLS.transportation}`,
        maxzoom: 14,
      },
      places: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URLS.places}`,
        maxzoom: 14,
      },
      kontur: {
        type: 'vector',
        tiles: [KONTUR_TILE_URL],
        maxzoom: KONTUR_MAX_ZOOM,
      },
    },
    layers: [
      {
        id: 'carto-basemap',
        type: 'raster',
        source: 'carto',
        paint: { 'raster-opacity': 0.6, 'raster-saturation': -1 },
      },
      {
        id: 'buildings-fill',
        type: 'fill',
        source: 'buildings',
        'source-layer': 'building',
        paint: {
          'fill-color': ['case',
            ['boolean', ['feature-state', 'inside'], false], '#737373',
            '#e5e5e5',
          ],
          'fill-opacity': ['case',
            ['boolean', ['feature-state', 'inside'], false], 0.7,
            0.6,
          ],
        },
      },
      {
        id: 'buildings-outline',
        type: 'line',
        source: 'buildings',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'line-color': ['case',
            ['boolean', ['feature-state', 'inside'], false], '#525252',
            '#c4c4c4',
          ],
          'line-width': ['case',
            ['boolean', ['feature-state', 'inside'], false], 0.8,
            0.3,
          ],
        },
      },
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'buildings',
        'source-layer': 'building',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['case',
            ['boolean', ['feature-state', 'inside'], false],
            '#525252',
            '#d4d4d4',
          ],
          'fill-extrusion-height': [
            'coalesce',
            ['get', 'height'],
            ['*', ['coalesce', ['get', 'num_floors'], 2], 3.5],
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      },
      // Road network overlay — brutalist red palette, class-based color + width
      {
        id: 'roads-overlay',
        type: 'line',
        source: 'transportation',
        'source-layer': 'segment',
        filter: ['==', ['get', 'subtype'], 'road'],
        layout: {
          visibility: 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['match', ['get', 'class'],
            'motorway', '#7f1d1d', 'trunk', '#991b1b',
            'primary', '#b91c1c', 'secondary', '#dc2626',
            'tertiary', '#ef4444', 'residential', '#f87171',
            'living_street', '#fca5a5', 'unclassified', '#fb923c',
            'footway', '#171717', 'pedestrian', '#171717',
            'path', '#404040', 'cycleway', '#525252',
            '#a3a3a3',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'],
            10, ['match', ['get', 'class'],
              'motorway', 2, 'trunk', 1.8, 'primary', 1.5,
              'secondary', 1.2, 'tertiary', 1,
              'residential', 0.6, 'living_street', 0.5,
              0.4,
            ],
            16, ['match', ['get', 'class'],
              'motorway', 8, 'trunk', 7, 'primary', 6,
              'secondary', 4.5, 'tertiary', 3.5,
              'residential', 2.5, 'living_street', 2,
              1.5,
            ],
          ],
          'line-opacity': 0.85,
        },
      },
      // POI dots — hidden by default, shown when Amenities section active
      {
        id: 'places-dots',
        type: 'circle',
        source: 'places',
        'source-layer': 'place',
        minzoom: 13,
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 4],
          'circle-color': '#737373',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 0.5,
          'circle-opacity': 0.8,
        },
      },
      {
        id: 'carto-labels',
        type: 'raster',
        source: 'carto-labels',
        paint: { 'raster-opacity': 0.7, 'raster-saturation': -1 },
      },
    ],
  };
}
