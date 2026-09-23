/* 챗봇 세션 생성을 위한 스키마 */
export interface InitRequest {
  lat: number;
  lon: number;
}

/* 챗봇과 상호작용을 위한 입력 스키마 */
export interface ChatRequest {
  thread_id: string;
  // confirmation을 함께 보낼 때(확인 질문에 버튼으로 답할 때)만 공백을 허용한다.
  // confirmation 없이 보내는 일반 대화 턴에서는 여전히 필수(공백 불가).
  user_prompt: string;
  // 직전 확인 질문("이 코스로 진행할까요?")에 버튼으로 답할 때만 실어 보낸다. 예 클릭 시 true,
  // 아니요 클릭 시 false. 일반 대화 턴에는 아예 보내지 않는다(필드 생략, false 아님).
  confirmation?: boolean;
  // 대화 도중 사용자가 이동했을 수 있으므로 매 요청에 최신 현재 위치를 함께 보낸다.
  // 백엔드가 이 값을 읽어 대화 상태의 출발지(current_location)를 갱신하면, 같은 스레드에서도
  // 이동한 위치 기준으로 경로가 계산된다. (백엔드가 아직 안 읽어도 무해한 추가 필드)
  lat?: number;
  lon?: number;
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

/* 턴바이턴 안내 종류. 백엔드가 향후 새 값을 추가할 수 있어 모르는 값도 일단 문자열로는 받되,
   변환 로직(utils/turnByTurn.ts)에서 모르는 값은 방어적으로 무시한다. */
export type ManeuverType = 'start' | 'left' | 'right' | 'u_turn' | 'arrive';

/* 턴바이턴 안내 한 지점. coordinates를 도로 스냅·교차로 정보까지 반영해 백엔드가 미리 계산해준
   것으로, utils/turnByTurn.ts가 이 배열이 있으면 프론트 자체 기하 계산 대신 이걸 우선 쓴다. */
export interface Maneuver {
  sequence: number;
  type: ManeuverType;
  instruction: string;
  location: [number, number]; // [위도, 경도]
  node_id: number | null;
  distance_from_start_m: number;
  distance_to_maneuver_m: number;
  bearing_before_deg: number | null;
  bearing_after_deg: number | null;
  turn_angle_deg: number | null;
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
  // 기록 탭에서 재구성한 경로(routeHistoryToWalkRoute)는 만들어주지 않는다 — 이 경우
  // utils/turnByTurn.ts가 자동으로 좌표 기반 기하 계산으로 폴백한다.
  maneuvers?: Maneuver[];
  // 아래는 백엔드가 함께 내려주지만 프론트에서 아직 쓰지 않는 필드들 — 타입 계약만 맞춰둔다.
  node_ids?: (number | null)[];
  nearby_pois?: unknown[];
  preference_applied?: boolean;
  preference_skipped_reason?: string | null;
  cost_alpha?: number | null;
  cost_beta?: number | null;
  selection_status?: string | null;
  target_distance_error_km?: number | null;
  candidate_unique_count?: number | null;
  candidate_duplicate_ratio?: number | null;
  route_seed?: number | null;
}

/* 안전/편안 선호 라벨 값 — 백엔드가 아직 내부 구조를 문서화하지 않아 느슨하게 둔다 */
export type FeatureLabelDetail = Record<string, unknown>;

/* 안전/편안 선호가 언급된 경우에만 채워지는 라벨 묶음 */
export interface FeatureLabels {
  safety?: FeatureLabelDetail;
  comfort?: FeatureLabelDetail;
}

/* 대화 상태 관련 스키마 */
export interface State {
  user_id: number;
  current_location: LocationInfo;

  mode: WalkMode | null;
  user_context:
    | CircularPreference
    | OnewayPreference
    | OnewayShortestPreference
    | null;

  origin_candidate: LocationInfo[] | null;
  destination_candidate: LocationInfo[] | null;
  // waypoint 모드에서 경유지 후보가 여러 개일 때 채워짐. 경유지 슬롯마다 후보 배열(또는 후보가
  // 하나로 확정된 경우 null)을 담는다.
  waypoint_candidates: (LocationInfo[] | null)[] | null;

  // 스키마상 배열이지만 백엔드는 경로 1개일 때 단일 객체로 보낸다. 소비하는 쪽(ChatConversation)에서
  // 항상 배열로 정규화한다.
  route_result: WalkRouteResponse[] | WalkRouteResponse | null;
  // oneway_shortest/oneway_random에서 출발·도착지가 둘 다 확정되면 채워짐.
  shortest_km: number | null;
  is_complete: boolean;
  awaiting_confirmation: boolean;
  user_prompt: string;
  response: string;
  feature_labels: FeatureLabels;
}

/* 챗봇과 상호작용을 통해 제공되는 출력 스키마(SSE result 이벤트의 data와 동일 스키마) */
export interface ChatResponse {
  status: ChatStatus;
  thread_id: string | null;
  state: State | null;
}

/* 스트리밍 도중 진행 상태를 알려주는 콜백 — event: progress의 순수 텍스트 */
export type PrewalkProgressHandler = (message: string) => void;
