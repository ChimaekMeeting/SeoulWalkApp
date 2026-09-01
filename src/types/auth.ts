// 백엔드가 HTTP 200 응답 본문으로 인증 실패를 알릴 때 사용하는 status 값 목록.
// 출처: src/types/survey.ts (SurveyStatus), src/types/prewalk.ts (ChatStatus, WalkRouteStatus)
// 백엔드 인증 코드가 바뀌면 이 파일만 수정한다.

const AUTH_STATUS = {
  ACCESS_EXPIRED_TOKEN: 'access_expired_token',
  INVALID_TOKEN: 'invalid_token',
  USER_NOT_FOUND: 'user_not_found',
} as const;

// access_expired_token, invalid_token: 재발급 시도 후 원래 요청을 재시도한다.
export const REFRESH_THEN_RETRY_STATUSES: ReadonlySet<string> = new Set([
  AUTH_STATUS.ACCESS_EXPIRED_TOKEN,
  AUTH_STATUS.INVALID_TOKEN,
]);

// user_not_found: 토큰을 재발급해도 소용없으므로 재발급 없이 즉시 로그아웃한다.
export const IMMEDIATE_LOGOUT_STATUSES: ReadonlySet<string> = new Set([
  AUTH_STATUS.USER_NOT_FOUND,
]);
