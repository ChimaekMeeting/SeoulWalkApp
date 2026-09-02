import React, { useCallback, useRef, useState } from 'react';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { WalkEndSnapshot, WalkExitEvent } from '../../types/walk';
import { useAndroidBackHandler } from '../../hooks/useAndroidBackHandler';
import { WalkPrepScreen } from './WalkPrepScreen';
import { WalkInProgressScreen } from './WalkInProgressScreen';
import { WalkEndConfirmModal } from './WalkEndConfirmModal';
import { WalkCompleteScreen } from './WalkCompleteScreen';

type Stage = 'prep' | 'walking' | 'complete';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  /** 산책 플로우를 빠져나가 홈으로 돌아갈 때. 취소/조기종료/완료를 event.reason으로 구분한다. */
  onExitToHome: (event: WalkExitEvent) => void;
}

/**
 * 6a(산책 전) → 6b(산책 중) → 6c(종료 확인) → 6d(완료)를 묶는 미니 플로우.
 * 아직 실제 네비게이션 스택이 없어 로컬 상태로 화면을 전환한다 —
 * 나중에 진짜 네비게이션이 생기면 이 컴포넌트 하나만 그 자리에 꽂으면 된다.
 */
export function WalkFlow({ routeResult, currentLocation, onExitToHome }: Props) {
  const [stage, setStage] = useState<Stage>('prep');
  const [endConfirmVisible, setEndConfirmVisible] = useState(false);
  // 진행률 100% 도달 시 뜨는 완주 확인 모달.
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<WalkEndSnapshot | null>(null);
  // 실제 walking 단계에 진입한 적이 있는지. prep에서 바로 취소한 경우와 구분한다.
  const walkingStartedRef = useRef(false);

  // 목표 거리의 90% 이상 걸었으면 완주로 본다(그 외엔 조기 종료). 세션 리셋 판단에는
  // 영향 없고(둘 다 actualWalkingStarted=true) 통계·분석용 구분이다.
  const traveledKm = snapshot?.traveledKm ?? 0;
  const completedRoute =
    routeResult.total_km > 0 && traveledKm / routeResult.total_km >= 0.9;

  const exitFromComplete = useCallback(() => {
    onExitToHome({
      reason: completedRoute ? 'completed' : 'ended_early',
      actualWalkingStarted: walkingStartedRef.current,
      elapsedMs: snapshot?.elapsedMs,
    });
  }, [completedRoute, snapshot?.elapsedMs, onExitToHome]);

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
    exitFromComplete();
    return true;
  }, [stage, endConfirmVisible, goalModalVisible, exitFromComplete, onExitToHome]);
  useAndroidBackHandler(handleAndroidBack);

  if (stage === 'prep') {
    return (
      <WalkPrepScreen
        routeResult={routeResult}
        currentLocation={currentLocation}
        onStart={() => {
          walkingStartedRef.current = true;
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
          routeResult={routeResult}
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
          title={'목표 거리를 완주했어요!\n산책을 완료할까요?'}
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

  return (
    <WalkCompleteScreen
      routeResult={routeResult}
      currentLocation={currentLocation}
      traveledKm={traveledKm}
      elapsedMs={snapshot?.elapsedMs ?? 0}
      steps={snapshot?.steps}
      routeId={routeResult.id ?? undefined}
      onHome={exitFromComplete}
    />
  );
}
