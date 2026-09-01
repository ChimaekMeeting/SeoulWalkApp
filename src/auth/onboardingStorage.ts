import * as SecureStore from 'expo-secure-store';

const HAS_SEEN_ONBOARDING_KEY = 'has_seen_onboarding';
const ACTIVITY_PROMPT_DONE_KEY = 'activity_prompt_done';

/**
 * SecureStore에 문자열 'true'로만 저장되는 1회성 플래그(온보딩 열람 여부·걸음 수 권한 안내 완료 여부).
 * 조회/저장 실패를 삼키지 않고 로그를 남긴 뒤, 앱이 무한 로딩이나 화면 반복에 빠지지 않도록
 * 안전한 기본값으로 폴백한다.
 *
 * - get: 값이 정확히 'true'일 때만 true. 없거나 다른 값이거나 조회 실패면 false.
 * - set: 저장이 실제로 성공했을 때만 true를 돌려준다(호출부는 이 결과를 보고 상태를 바꿔야 함).
 */
function booleanFlag(key: string) {
  return {
    get: async (): Promise<boolean> => {
      try {
        return (await SecureStore.getItemAsync(key)) === 'true';
      } catch (e) {
        console.warn(`[storage] ${key} 조회 실패 → false로 폴백:`, e);
        return false;
      }
    },
    set: async (): Promise<boolean> => {
      try {
        await SecureStore.setItemAsync(key, 'true');
        return true;
      } catch (e) {
        console.warn(`[storage] ${key} 저장 실패:`, e);
        return false;
      }
    },
  };
}

const onboardingFlag = booleanFlag(HAS_SEEN_ONBOARDING_KEY);
const activityPromptFlag = booleanFlag(ACTIVITY_PROMPT_DONE_KEY);

export const onboardingStorage = {
  /** 온보딩을 이미 봤는지. 저장 값이 'true'일 때만 true. */
  getHasSeen: onboardingFlag.get,
  /** 온보딩 열람 기록을 저장. 저장 성공 여부를 boolean으로 돌려준다. */
  markSeen: onboardingFlag.set,
};

export const activityPromptStorage = {
  /** 걸음 수 권한 안내 화면에서 허용/건너뛰기를 이미 눌렀는지. 저장 값이 'true'일 때만 true. */
  getPromptDone: activityPromptFlag.get,
  /** 걸음 수 권한 안내 완료를 저장. 저장 성공 여부를 boolean으로 돌려준다. */
  markPromptDone: activityPromptFlag.set,
};
