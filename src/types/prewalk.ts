/* 챗봇 세션 생성을 위한 스키마 */
export interface InitRequest {
  lat: number;
  lon: number;
}

/* 챗봇과 상호작용을 위한 입력 스키마 */
export interface ChatRequest {
  thread_id: string;
  user_prompt: string;
}

/* 챗봇 상태를 알려주는 스키마 */
export enum ChatStatus {
  SUCCESS = 'success',
  ACCESS_EXPIRED_TOKEN = 'access_expired_token',
  INVALID_TOKEN = 'invalid_token',
  SESSION_NOT_FOUND = 'session_not_found',
  UNACCESSIBLE = 'unaccessible',
  INTERNAL_ERROR = 'internal_error',
}

/* 산책 경로 상태를 알려주는 스키마 */
export enum WalkRouteStatus {
  SUCCESS = 'success',
  INVALID_ORIGIN = 'invalid_origin',
  INVALID_DESTINATION = 'invalid_destination',
  NO_NEAREST_START_NODE = 'no_nearest_start_node',
  NO_NEAREST_END_NODE = 'no_nearest_end_node',
  NO_PATH = 'no_path',
  RETURN_PATH_NOT_FOUND = 'return_path_not_found',
  PARTIAL_ROUTE = 'partial_route',
  WEIGHT_RELAXED = 'weight_relaxed',
  RADIUS_EXPANDED = 'radius_expanded',
  UNKNOWN_ERROR = 'unknown_error',
  ACCESS_EXPIRED_TOKEN = 'access_expired_token',
  INVALID_TOKEN = 'invalid_token',
}

/* 위치 관련 스키마 */
export interface LocationInfo {
  lat: number | null;
  lon: number | null;
  address: string | null;
  place_name: string | null;
}

/* 산책 모드 */
export enum WalkMode {
  CIRCULAR_RANDOM = 'circular_random',
  ONEWAY_SHORTEST = 'oneway_shortest',
  ONEWAY_RANDOM = 'oneway_random',
}

/* 산책 정보 관련 베이스 스키마 */
export interface BasePreference {
  mode: WalkMode;
  origin: LocationInfo | null;
}

/* 순환 경로 산책 관련 스키마 */
export interface CircularPreference extends BasePreference {
  target_km: number | null;
}

/* 편도 경로 산책 관련 스키마 */
export interface OnewayPreference extends BasePreference {
  destination: LocationInfo | null;
  target_km: number | null;
}

/* 편도 우회 경로 관련 스키마 */
export interface OnewayShortestPreference extends BasePreference {
  destination: LocationInfo | null;
}

/* 산책 경로 관련 스키마 */
export interface WalkRouteResponse {
  status: WalkRouteStatus;
  mode: WalkMode;
  coordinates: [number, number][]; // [위도, 경도]
  total_km: number;
  // RouteHistory로 자동 저장된 경우에만 채워짐(즐겨찾기 PATCH /api/user/routes/{id}/favorite 호출에 사용).
  id?: number | null;
  // 기록 탭에서 저장된 경로를 다시 선택해 들어온 경우에만 채워짐(그 경로의 현재 즐겨찾기 여부).
  is_favorite?: boolean | null;
}

/* 대화 상태 관련 스키마 */
export interface State {
  user_id: number;
  current_LocationInfo: LocationInfo;
  access_token: string | null;

  mode: WalkMode | null;
  user_context:
  | CircularPreference
  | OnewayPreference
  | OnewayShortestPreference
  | null;

  origin_candidate: LocationInfo[] | null;
  destination_candidate: LocationInfo[] | null;

  route_result: WalkRouteResponse | null;
  is_complete: boolean;
  awaiting_confirmation: boolean;
  user_prompt: string;
  response: string;
  themes: string[];
}

/* 챗봇과 상호작용을 통해 제공되는 출력 스키마 */
export interface ChatResponse {
  status: ChatStatus;
  thread_id: string | null;
  state: State | null;
}
