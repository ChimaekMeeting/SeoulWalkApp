/* 산책 진행 상태. 시각은 저장하지 않고 이 세 값만 오간다(조기 종료해도 in_progress에 머문다 —
   완주 못 한 산책을 따로 집계하려면 별도 상태가 필요하지만 지금 계약엔 없다). */
export type WalkProgressStatus = 'recommended' | 'in_progress' | 'completed';

/* POST .../start, POST .../complete 공통 응답. */
export interface WalkProgressResponse {
  walk_status: WalkProgressStatus;
  /** 완주한 날짜(YYYY-MM-DD, 한국 시간). 완주 전엔 null. */
  walked_on: string | null;
}

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
  // 챗봇을 거쳐 만든 경로에만 채워진다 — 직접 경로 API(/api/walk/route)로 만든 경로와 이전 기록은
  // null(HistoryPlaceLabel이 이 값이 없으면 좌표 역지오코딩으로 대체한다).
  origin_address: string | null;
  origin_place_name: string | null;
  // 순환 경로는 도착지가 없어 이 두 필드가 항상 null.
  destination_address: string | null;
  destination_place_name: string | null;
  walk_status: WalkProgressStatus;
  walked_on: string | null;
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
  // true면 walk_status는 무시되고 즐겨찾기 경로만 조회된다.
  is_favorite?: boolean;
  // 생략하면 'completed'(완주한 경로)로 취급된다. is_favorite=true와 함께 보내면 무시된다.
  walk_status?: Exclude<WalkProgressStatus, 'recommended'>;
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
