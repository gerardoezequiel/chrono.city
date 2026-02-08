export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface LngLat {
  lng: number;
  lat: number;
}

export type StudyAreaMode = 'isochrone' | 'ring';
