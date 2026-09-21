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

/* GET /api/user/routes 응답 (백엔드 RouteHistoryResponse 그대로) */
export interface RouteHistoryResponse {
  histories: RouteHistoryItem[];
  total: number;
}

/* GET /api/user/routes 쿼리 파라미터 */
export interface RouteHistoryQuery {
  limit?: number;
  offset?: number;
  is_favorite?: boolean;
}

export interface RouteFeedbackRequest {
  rating_safety: number;
  rating_comfort: number;
  rating_overall: number;
}

export type RouteFeedbackStatus =
  | 'success'
  | 'insufficient_candidates'
  | 'access_expired_token'
  | 'refresh_expired_token'
  | 'invalid_token'
  | 'user_not_found'
  | 'route_not_found';

export interface RouteFeedbackResponse {
  status: RouteFeedbackStatus;
  weights_safety: number | null;
  weights_comfort: number | null;
}
