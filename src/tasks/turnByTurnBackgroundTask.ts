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
 * 잠금화면·알림창에 보이는 진행 상황은 이 태스크가 직접 올리는 지속 알림(ONGOING_NOTIFICATION_ID)
 * 하나뿐이다 — 안드로이드가 강제하는 포그라운드 서비스 알림(useTurnByTurn.ts가 startLocationUpdatesAsync
 * 에 거는 것)은 백그라운드 위치 서비스를 유지하기 위한 기술적 요건일 뿐이라, 이 지속 알림과 헷갈리지
 * 않도록 일부러 다른 문구를 쓴다. 지속 알림은 `trigger: null`(=기본 채널)로만 보낸다 — 전용 채널을
 * 새로 만들어 트리거로 라우팅해봤더니 알림 내용이 통째로 안 뜨는 기기가 있어(원인 미확정), 실제로
 * 내용이 뜨는 걸 확인한 이 조합만 쓴다. 잠금화면 노출·진동 억제(채널 중요도 조정)는 채널 생성 후
 * 안드로이드가 대부분 값을 잠가버려 앱에서 사후 변경이 잘 안 먹는 영역이라, 지금은 시도하지 않는다.
 * 턴 알림(사운드 있는 1회성 안내)만 따로, 턴이 바뀔 때 한 번 보낸다.
 */
export const TURN_BY_TURN_LOCATION_TASK = 'turn-by-turn-location-task';

export const TURN_BY_TURN_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10,
  showsBackgroundLocationIndicator: true,
  pausesUpdatesAutomatically: false,
};

// 안드로이드가 강제하는 포그라운드 서비스 알림용 — 지속 알림("산책 안내 중")과 겹쳐 보이지 않도록
// 일부러 다른 제목/문구를 쓴다. useTurnByTurn.ts의 최초 시작 호출에서만 쓰이고 이후 갱신되지 않는다.
export const TURN_BY_TURN_FOREGROUND_SERVICE_TITLE = '위치 사용 중';
export const TURN_BY_TURN_FOREGROUND_SERVICE_BODY = '화면이 꺼져도 산책 안내가 계속돼요.';

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
  const { route, lastAnnouncedAtKm } = result.session;

  const decision = decideBackgroundAnnouncement(
    route,
    [latest.coords.latitude, latest.coords.longitude],
    lastAnnouncedAtKm,
  );
  if (!decision.step) return;

  // 지속 알림 — 매 GPS fix마다 남은 거리로 다시 그려 잠금화면·알림창에서도 실시간으로 보이게 한다.
  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_NOTIFICATION_ID,
    content: {
      title: '산책 안내 중',
      body: formatTurnInstruction(decision.step.kind, decision.distanceToKm),
      sticky: true,
      sound: false,
    },
    trigger: null,
  }).catch(() => {});

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
