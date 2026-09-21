import React, { useCallback, useRef, useState } from 'react';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { WalkEndSnapshot, WalkExitEvent, WalkRatings } from '../../types/walk';
import { submitRouteFeedback } from '../../api/routes';
import { useAndroidBackHandler } from '../../hooks/useAndroidBackHandler';
import { useBackgroundLocationPermission } from '../../hooks/useBackgroundLocationPermission';
import { WalkPrepScreen } from './WalkPrepScreen';
import { WalkInProgressScreen } from './WalkInProgressScreen';
import { WalkEndConfirmModal } from './WalkEndConfirmModal';
import { WalkCompleteScreen } from './WalkCompleteScreen';
import { WalkRatingScreen } from './WalkRatingScreen';

type Stage = 'prep' | 'walking' | 'complete' | 'rating';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  /** 도로 스냅(Map Matching)이 아직 진행 중인지. true면 prep의 "산책 시작" 버튼을 잠근다. */
  routeSnapPending: boolean;
  /** 산책 플로우를 빠져나가 홈으로 돌아갈 때. 취소/조기종료/완료를 event.reason으로 구분한다. */
  onExitToHome: (event: WalkExitEvent) => void;
}

/**
 * 6a(산책 전) → 6b(산책 중) → 6c(종료 확인) → 6d(완료) → 6e(별점)를 묶는 미니 플로우.
 * 아직 실제 네비게이션 스택이 없어 로컬 상태로 화면을 전환한다 —
 * 나중에 진짜 네비게이션이 생기면 이 컴포넌트 하나만 그 자리에 꽂으면 된다.
 */
export function WalkFlow({
  routeResult,
  currentLocation,
  routeSnapPending,
  onExitToHome,
}: Props) {
  const [stage, setStage] = useState<Stage>('prep');
  const [endConfirmVisible, setEndConfirmVisible] = useState(false);
  // 종착점 도착으로 완료가 확정됐을 때 뜨는 완료 확인 모달.
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<WalkEndSnapshot | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // 실제 walking 단계에 진입한 적이 있는지. prep에서 바로 취소한 경우와 구분한다.
  const walkingStartedRef = useRef(false);
  // walking 진입 시점의 경로를 얼려, 산책 도중 스냅 결과가 도착해도 tracker 기준이 바뀌지 않게 한다.
  const frozenRouteRef = useRef<WalkRouteResponse | null>(null);
  const walkRoute = frozenRouteRef.current ?? routeResult;
  // 첫 렌더의 routeResult는 항상 도로 스냅 전 원본(스냅은 이후 비동기로 도착) — 개발용으로 원본
  // 경로를 지도에 겹쳐 스냅이 도보로에 제대로 붙었는지 대조하기 위해 보관한다.
  const [originalRouteCoords] = useState(() => routeResult.coordinates);

  // 화면을 꺼도 턴바이턴 안내를 이어받을지("항상 허용" 위치 권한) — prep 화면에서 한 번 물어보고,
  // 그 결과(granted 여부)를 walking 단계까지 그대로 들고 간다. 산책 중간에 새삼 권한을 묻지 않도록
  // 여기(WalkFlow)에서 한 번만 상태를 들고 두 화면에 나눠 내려준다.
  const bgPermission = useBackgroundLocationPermission();
  const [bgPromptDismissed, setBgPromptDismissed] = useState(false);

  // 종착점 geofence 도달(endReason)로 완주/조기 종료를 구분한다. 세션 리셋 판단에는 영향 없고
  // (둘 다 actualWalkingStarted=true) 통계·분석용 구분이다.
  const completedRoute = snapshot?.endReason === 'destination_arrived';

  const exitFromComplete = useCallback(() => {
    onExitToHome({
      reason: completedRoute ? 'completed' : 'ended_early',
      actualWalkingStarted: walkingStartedRef.current,
      elapsedMs: snapshot?.elapsedMs,
    });
  }, [completedRoute, snapshot?.elapsedMs, onExitToHome]);

  const submitRatings = useCallback(
    async (ratings: WalkRatings) => {
      if (walkRoute.id == null) {
        setFeedbackError('경로 기록을 찾지 못해 별점을 저장할 수 없어요.');
        return;
      }

      setFeedbackSubmitting(true);
      setFeedbackError(null);
      try {
        const result = await submitRouteFeedback(walkRoute.id, {
          rating_safety: ratings.safety,
          rating_comfort: ratings.comfort,
          rating_overall: ratings.overall,
        });
        // insufficient_candidates여도 별점 자체는 서버에 저장된다. 장기 가중치만
        // 후보 대조가 가능한 다음 경로부터 갱신되므로 정상 완료로 취급한다.
        if (
          result.status === 'success' ||
          result.status === 'insufficient_candidates'
        ) {
          exitFromComplete();
          return;
        }
        setFeedbackError('별점을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      } catch {
        setFeedbackError('별점을 저장하지 못했어요. 네트워크 연결을 확인해 주세요.');
      } finally {
        setFeedbackSubmitting(false);
      }
    },
    [walkRoute.id, exitFromComplete],
  );

  // 안드로이드 하드웨어 뒤로가기 — 단계별로 처리한다.
  // (모달이 떠 있을 땐 RN Modal의 onRequestClose가 back을 가로채므로 여기까지 오지 않는다.)
  const handleAndroidBack = useCallback(() => {
    if (stage === 'prep') {
      onExitToHome({ reason: 'cancelled_before_start', actualWalkingStarted: false });
      return true;
    }
    if (stage === 'walking') {
      if (!endConfirmVisible && !goalModalVisible) setEndConfirmVisible(true);
      return true;
    }
    if (stage === 'rating') {
      setStage('complete');
      return true;
    }
    // 평가는 선택사항이다. 완료 요약 화면에서 뒤로가면 홈으로 나간다.
    exitFromComplete();
    return true;
  }, [stage, endConfirmVisible, goalModalVisible, onExitToHome, exitFromComplete]);
  useAndroidBackHandler(handleAndroidBack);

  if (stage === 'prep') {
    return (
      <WalkPrepScreen
        routeResult={routeResult}
        currentLocation={currentLocation}
        snapPending={routeSnapPending}
        bgPermissionStatus={bgPermission.status}
        bgPromptDismissed={bgPromptDismissed}
        onAllowBackgroundLocation={bgPermission.request}
        onOpenBackgroundLocationSettings={bgPermission.openSettings}
        onDismissBackgroundPrompt={() => setBgPromptDismissed(true)}
        onStart={coordinates => {
          walkingStartedRef.current = true;
          // 방향 전환 안 했으면(같은 배열 참조) routeResult를 그대로 써서 불필요한 객체를 안 만든다.
          frozenRouteRef.current =
            coordinates === routeResult.coordinates ? routeResult : { ...routeResult, coordinates };
          setStage('walking');
        }}
        onBack={() =>
          onExitToHome({
            reason: 'cancelled_before_start',
            actualWalkingStarted: false,
          })
        }
      />
    );
  }

  if (stage === 'walking') {
    return (
      <>
        <WalkInProgressScreen
          routeResult={walkRoute}
          originalRouteCoordinates={originalRouteCoords}
          backgroundLocationGranted={bgPermission.granted}
          onRequestEnd={s => {
            setSnapshot(s);
            setEndConfirmVisible(true);
          }}
          onGoalReached={s => {
            setSnapshot(s);
            setGoalModalVisible(true);
          }}
        />
        <WalkEndConfirmModal
          visible={endConfirmVisible}
          onCancel={() => setEndConfirmVisible(false)}
          onConfirm={() => {
            setEndConfirmVisible(false);
            setStage('complete');
          }}
        />
        <WalkEndConfirmModal
          visible={goalModalVisible}
          icon="🎉"
          title={'종착점에 도착했어요!\n산책을 완료할까요?'}
          confirmLabel="완료"
          cancelLabel="더 걷기"
          onCancel={() => setGoalModalVisible(false)}
          onConfirm={() => {
            setGoalModalVisible(false);
            setStage('complete');
          }}
        />
      </>
    );
  }

  if (stage === 'complete') {
    return (
      <WalkCompleteScreen
        routeResult={walkRoute}
        currentLocation={currentLocation}
        routeProgressKm={snapshot?.routeProgressKm ?? 0}
        actualDistanceKm={snapshot?.actualDistanceKm}
        elapsedMs={snapshot?.elapsedMs ?? 0}
        steps={snapshot?.steps}
        routeId={walkRoute.id ?? undefined}
        onNext={() => setStage('rating')}
        onExit={exitFromComplete}
      />
    );
  }

  return (
    <WalkRatingScreen
      onSubmit={submitRatings}
      submitting={feedbackSubmitting}
      errorMessage={feedbackError}
      onSkip={exitFromComplete}
    />
  );
}
