/* 저장된 산책 경로 기록 스키마 (백엔드 RouteHistoryItem 그대로) */
export interface RouteHistoryItem {
  id: number;
  mode: string;
  origin_lat: number;
  origin_lon: number;
  destination_lat: number | null;
  destination_lon: number | null;
  coordinates: number[][];
  total_km: number;
  is_favorite: boolean;
  created_at: string;
}
