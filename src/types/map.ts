export interface LatLng {
  lat: number;
  lng: number;
}

export type POIType = 'bench' | 'toilet' | 'cctv' | 'cafe' | 'spot';

export interface POIProperties {
  id: string;
  type: POIType;
  name: string;
}

export interface RouteProperties {
  distance: number;
  duration: number;
  mode: 'healing' | 'calorie' | 'active';
}
