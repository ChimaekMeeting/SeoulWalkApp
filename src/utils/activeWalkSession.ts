import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalkRouteResponse } from '../types/prewalk';

const ACTIVE_WALK_SESSION_KEY = 'active_walk_session_v1';

export interface ActiveWalkSession {
  route: WalkRouteResponse['coordinates'];
  /** 알림·TTS로 이미 안내한 턴의 atKm(중복 안내 방지). 포그라운드 훅과 백그라운드 태스크가 공유. */
  lastAnnouncedAtKm: number | null;
  startedAt: number;
}

export type ReadSessionResult =
  | { ok: true; session: ActiveWalkSession | null }
  | { ok: false; error: unknown };

/**
 * "지금 산책 중인 경로"를 AsyncStorage에 저장해둔다. 백그라운드 위치 태스크
 * (tasks/turnByTurnBackgroundTask.ts)는 React 트리 밖 별도 JS 컨텍스트에서 실행될 수 있어
 * useTurnByTurn 훅이 들고 있는 state를 직접 읽을 수 없다 — 이 모듈이 둘 사이를 잇는 유일한 통로다.
 * 기존 유일한 영속화 수단인 expo-secure-store(src/auth/onboardingStorage.ts)는 값 크기가
 * 2048바이트로 제한돼 경로 좌표 배열(길게는 수십~수백 KB)을 못 담아 AsyncStorage를 새로 쓴다.
 *
 * onboardingStorage.ts와 같은 컨벤션 — 조회 실패(ok:false)와 "세션 없음"(ok:true, session:null)을
 * 구분한다. 쓰기/갱신/삭제는 실패해도 throw하지 않고 console.warn만 남긴다(매 GPS fix마다 호출될
 * 수 있어 예외로 화면·백그라운드 태스크를 깨뜨리면 안 된다).
 */
export const activeWalkSession = {
  read: async (): Promise<ReadSessionResult> => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_WALK_SESSION_KEY);
      if (raw == null) return { ok: true, session: null };
      const parsed = JSON.parse(raw) as Partial<ActiveWalkSession> | null;
      // 손상된 JSON이나 예전 스키마가 남아있으면 "세션 없음"으로 취급(형태 최소 방어).
      if (!parsed || !Array.isArray(parsed.route) || typeof parsed.startedAt !== 'number') {
        return { ok: true, session: null };
      }
      return {
        ok: true,
        session: {
          route: parsed.route,
          lastAnnouncedAtKm: parsed.lastAnnouncedAtKm ?? null,
          startedAt: parsed.startedAt,
        },
      };
    } catch (error) {
      console.warn('[activeWalkSession] 조회 실패:', error);
      return { ok: false, error };
    }
  },

  write: async (session: ActiveWalkSession): Promise<void> => {
    try {
      await AsyncStorage.setItem(ACTIVE_WALK_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn('[activeWalkSession] 저장 실패:', error);
    }
  },

  /** 세션이 있을 때만 일부 필드를 갱신한다(route 재전송 없이). 세션이 없으면 아무 일도 안 한다. */
  update: async (patch: Partial<Omit<ActiveWalkSession, 'route' | 'startedAt'>>): Promise<void> => {
    const result = await activeWalkSession.read();
    if (!result.ok || !result.session) return;
    await activeWalkSession.write({ ...result.session, ...patch });
  },

  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(ACTIVE_WALK_SESSION_KEY);
    } catch (error) {
      console.warn('[activeWalkSession] 삭제 실패:', error);
    }
  },
};
