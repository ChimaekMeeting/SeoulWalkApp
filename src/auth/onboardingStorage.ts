import * as SecureStore from 'expo-secure-store';

const HAS_SEEN_ONBOARDING_KEY = 'has_seen_onboarding';
const ACTIVITY_PROMPT_DONE_KEY = 'activity_prompt_done';
const SURVEY_COMPLETED_KEY = 'survey_completed_v1';

/**
 * 플래그 조회 결과. "저장소가 정상이고 값이 이러이러하다"(ok: true)와
 * "저장소 조회 자체가 실패했다"(ok: false)를 구분한다 — 조회 실패를 "값 없음"으로
 * 뭉뚱그리면 기존 사용자가 신규 사용자처럼 온보딩으로 되돌아가는 버그가 난다.
 */
export type ReadFlagResult =
  | { ok: true; value: boolean; raw: string | null }
  | { ok: false; error: unknown };

/**
 * SecureStore에 문자열 'true'로만 저장되는 1회성 플래그(온보딩 열람 여부·걸음 수 권한 안내
 * 완료 여부·설문 완료 보조 캐시).
 *
 * - read : 조회 성공/실패를 구분해서 돌려준다(호출부가 재시도·폴백을 결정).
 * - get  : read를 boolean으로 축약한 편의 함수(값이 정확히 'true'일 때만 true, 실패도 false).
 * - set  : setItemAsync 후 즉시 getItemAsync로 실제 저장 값을 재확인한다. 쓰기 호출이
 *          resolve됐어도 값이 실제로 남지 않는 경우가 있어(디스크/키체인 이슈) 검증까지 통과해야 true.
 * - clear: 플래그를 삭제한다(실패해도 조용히 로그만 — 다음 조회가 '값 없음'으로 이어짐).
 */
function booleanFlag(key: string) {
  const read = async (): Promise<ReadFlagResult> => {
    try {
      const raw = await SecureStore.getItemAsync(key);
      return { ok: true, value: raw === 'true', raw };
    } catch (error) {
      console.warn(`[storage] ${key} 조회 실패:`, error);
      return { ok: false, error };
    }
  };

  return {
    read,
    get: async (): Promise<boolean> => {
      const result = await read();
      return result.ok && result.value;
    },
    set: async (): Promise<boolean> => {
      try {
        await SecureStore.setItemAsync(key, 'true');

        const writtenValue = await SecureStore.getItemAsync(key);
        const saved = writtenValue === 'true';

        if (__DEV__) {
          console.log('[storage] flag write result', { key, writtenValue, saved });
        }

        return saved;
      } catch (error) {
        console.warn(`[storage] ${key} 저장 실패:`, error);
        return false;
      }
    },
    clear: async (): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.warn(`[storage] ${key} 삭제 실패:`, error);
      }
    },
  };
}

const onboardingFlag = booleanFlag(HAS_SEEN_ONBOARDING_KEY);
const activityPromptFlag = booleanFlag(ACTIVITY_PROMPT_DONE_KEY);
const surveyCompletedFlag = booleanFlag(SURVEY_COMPLETED_KEY);

export const onboardingStorage = {
  /** 온보딩을 이미 봤는지. 조회 실패와 "값 없음"을 구분한 결과를 돌려준다. */
  readHasSeen: onboardingFlag.read,
  /** 온보딩 열람 기록을 저장하고, 저장 값을 재확인한 성공 여부를 돌려준다. */
  markSeen: onboardingFlag.set,
};

export const activityPromptStorage = {
  /** 걸음 수 권한 안내 화면에서 허용/건너뛰기를 이미 눌렀는지. 저장 값이 'true'일 때만 true. */
  getPromptDone: activityPromptFlag.get,
  /** 걸음 수 권한 안내 완료를 저장. 저장 성공 여부를 boolean으로 돌려준다. */
  markPromptDone: activityPromptFlag.set,
};

export const surveyCompletedStorage = {
  /**
   * 설문(산책 취향) 완료 여부의 보조 캐시. 정답은 서버(GET /api/user/survey)지만, 앱 시작 시
   * 설문 조회가 네트워크 오류·콜드스타트 타임아웃으로 실패했을 때 기존 사용자를 신규 사용자로
   * 오판해 설문을 다시 띄우는 것을 막는 용도로만 쓴다. 값이 정확히 'true'일 때만 true.
   */
  get: surveyCompletedFlag.get,
  /** 설문 완료를 로컬에 표시(서버 저장이 확인된 뒤 호출). 저장 성공 여부를 boolean으로 돌려준다. */
  markCompleted: surveyCompletedFlag.set,
  /** 로컬 완료 표시를 제거한다([DEV] 설문 다시 보기 등). */
  clear: surveyCompletedFlag.clear,
};
