import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { activeWalkSession } from '../utils/activeWalkSession';
import { decideBackgroundAnnouncement, formatTurnInstruction } from '../utils/turnByTurn';

/**
 * 이 태스크 이름으로 useTurnByTurn이 `Location.startLocationUpdatesAsync`를 건다. 안드로이드가
 * 앱을 완전히 백그라운드로 내리거나(포그라운드 서비스로 JS를 살려둠) 프로세스를 새로 띄워 headless로
 * 이 태스크만 실행할 수도 있으므로, `TaskManager.defineTask` 호출 자체는 반드시 앱 진입점(App.tsx)에서
 * 무조건 import돼 있어야 한다 — WalkInProgressScreen이 마운트될 때만 이 파일이 로드되면, headless
 * 재시작 시 태스크 정의가 없어 조용히 무시된다.
 *
 * 매 위치 업데이트마다: activeWalkSession(산책 중 경로 + 마지막 안내 지점)을 읽는다 → 세션이 없으면
 * (산책 중이 아니거나 이미 정리됨) 아무 것도 안 하고 return — 앱이 강제 종료돼 정리를 못 했을 때의
 * 안전장치. 세션이 있으면 decideBackgroundAnnouncement(순수 함수, utils/turnByTurn.ts, Jest로 검증됨)
 * 로 다음 턴과 "지금 안내해야 하는지"를 판정한다.
 *
 * 알림(expo-notifications)은 백그라운드에서 가장 신뢰할 수 있는 채널이라 항상 보낸다. TTS
 * (expo-speech)는 best-effort로 같이 시도한다 — 안드로이드는 포그라운드 서비스가 JS를 살려두는
 * 동안 대체로 재생되지만, iOS는 백그라운드 실행 창이 짧아 보장되지 않는다. 두 알림(턴 알림/지속
 * 알림)은 턴이 바뀔 때만 갱신해 매 GPS fix마다 스팸이 되지 않게 한다.
 */
export const TURN_BY_TURN_LOCATION_TASK = 'turn-by-turn-location-task';

const ONGOING_NOTIFICATION_ID = 'turn-by-turn-ongoing';

TaskManager.defineTask(TURN_BY_TURN_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[turnByTurnBackgroundTask]', error.message);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const result = await activeWalkSession.read();
  if (!result.ok || !result.session) return;
  const { route, lastAnnouncedAtKm, lastNotifiedAtKm } = result.session;

  const decision = decideBackgroundAnnouncement(
    route,
    [latest.coords.latitude, latest.coords.longitude],
    lastAnnouncedAtKm,
  );
  if (!decision.step) return;

  // 지속 알림 — 턴이 바뀐 경우에만 다시 그린다.
  if (decision.step.atKm !== lastNotifiedAtKm) {
    await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_NOTIFICATION_ID,
      content: {
        title: '산책 안내 중',
        body: formatTurnInstruction(decision.step.kind, decision.distanceToKm),
        sticky: true,
      },
      trigger: null,
    }).catch(() => {});
    await activeWalkSession.update({ lastNotifiedAtKm: decision.step.atKm });
  }

  if (decision.shouldAnnounce) {
    const text = formatTurnInstruction(decision.step.kind, decision.distanceToKm);
    await Notifications.scheduleNotificationAsync({
      content: { title: '턴 안내', body: text, sound: true },
      trigger: null,
    }).catch(() => {});
    Speech.speak(text, { language: 'ko-KR' });
    await activeWalkSession.update({ lastAnnouncedAtKm: decision.step.atKm });
  }
});
