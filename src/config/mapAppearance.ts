import * as SecureStore from 'expo-secure-store';
import { mapConfig } from './mapConfig';

export type MapAppearanceMode = 'light' | 'dark';
export type MapAppearanceKey = 'overview' | 'walk';
export type MapAppearanceModes = Record<MapAppearanceKey, MapAppearanceMode>;

/**
 * 홈(overview)·산책 중(walk) 지도의 라이트/다크 모드 — 마이페이지에서 사용자가 각각 따로 고른다.
 * AppMapView가 이 store를 구독해서 styleURL을 정하고(mapConfig.styleUrls[모드]), MyPageScreen의
 * 선택 버튼이 setMapAppearanceMode로 값을 바꾼다. useDevLocationOverride(devLocationOverride.ts)와
 * 같은 모듈 스코프 store + useSyncExternalStore 패턴 — 두 화면이 항상 같은 트리에 마운트되어
 * 있진 않으므로(MainRouter가 탭을 display:none으로만 숨김) prop drilling 대신 이 방식을 쓴다.
 *
 * SecureStore 조회는 비동기라 첫 렌더는 mapConfig.defaultMapModes로 보이고, 저장된 값이 있으면
 * 로드 완료 시 구독자에게 알려 리렌더된다(잠깐의 기본값 노출은 지도 타일 로딩 시간에 묻힌다).
 */

const STORAGE_KEYS: Record<MapAppearanceKey, string> = {
  overview: 'map_appearance_overview',
  walk: 'map_appearance_walk',
};

let modes: MapAppearanceModes = { ...mapConfig.defaultMapModes };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(listener => listener());
}

function isMode(value: string | null): value is MapAppearanceMode {
  return value === 'light' || value === 'dark';
}

/** 앱 시작 시 SecureStore에 저장된 값을 메모리 store에 반영한다(값이 없으면 기본값 유지). */
async function load(): Promise<void> {
  const [overview, walk] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.overview).catch(() => null),
    SecureStore.getItemAsync(STORAGE_KEYS.walk).catch(() => null),
  ]);
  const next: MapAppearanceModes = {
    overview: isMode(overview) ? overview : modes.overview,
    walk: isMode(walk) ? walk : modes.walk,
  };
  if (next.overview === modes.overview && next.walk === modes.walk) return;
  modes = next;
  notify();
}
load();

/** 현재 지도 모드({overview, walk}). useSyncExternalStore의 getSnapshot으로 쓴다. */
export function getMapAppearanceModes(): MapAppearanceModes {
  return modes;
}

/** key(overview/walk)의 모드를 바꾸고 구독자에게 알린 뒤 SecureStore에 저장한다. */
export function setMapAppearanceMode(key: MapAppearanceKey, mode: MapAppearanceMode): void {
  if (modes[key] === mode) return;
  modes = { ...modes, [key]: mode };
  notify();
  SecureStore.setItemAsync(STORAGE_KEYS[key], mode).catch(error => {
    console.warn(`[mapAppearance] ${key} 저장 실패:`, error);
  });
}

/** 지도 모드 변경 구독. 해제 함수를 돌려준다(useSyncExternalStore 규약). */
export function subscribeMapAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
