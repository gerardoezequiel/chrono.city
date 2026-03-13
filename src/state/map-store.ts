import { create } from 'zustand';
import type maplibregl from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';

interface MapState {
  /** MapLibre instance ref — set once on map ready */
  map: maplibregl.Map | null;
  /** Whether the map has finished initial load */
  isReady: boolean;
  /** 3D buildings toggle */
  is3D: boolean;
  /** Isochrone polygon features (the ONE cross-section bridge) */
  isochroneFeatures: Feature<Polygon>[];

  setMap: (map: maplibregl.Map) => void;
  setIsReady: (ready: boolean) => void;
  toggleIs3D: () => void;
  setIsochroneFeatures: (features: Feature<Polygon>[]) => void;
}

export const useMapStore = create<MapState>((set) => ({
  map: null,
  isReady: false,
  is3D: false,
  isochroneFeatures: [],

  setMap: (map) => set({ map, isReady: true }),
  setIsReady: (isReady) => set({ isReady }),
  toggleIs3D: () => set((s) => ({ is3D: !s.is3D })),
  setIsochroneFeatures: (isochroneFeatures) => set({ isochroneFeatures }),
}));
