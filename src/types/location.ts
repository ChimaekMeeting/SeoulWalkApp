/* 기기 GPS 좌표(useLocation/useWatchLocation 공용). */
export interface Coordinates {
  latitude: number;
  longitude: number;
  /** fix 측정 시각(ms epoch). watchPositionAsync가 주면 채워지고, 없으면 호출부가 Date.now()로 채운다. */
  timestamp?: number;
  /** 수평 정확도(m). 진행률 트래커의 동적 허용 반경 계산에 쓴다. 값이 없으면 기본 반경 사용. */
  accuracy?: number | null;
}
