import React, { useState } from 'react';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { WalkPrepScreen } from './WalkPrepScreen';
import { WalkInProgressScreen, WalkEndSnapshot } from './WalkInProgressScreen';
import { WalkEndConfirmModal } from './WalkEndConfirmModal';
import { WalkCompleteScreen } from './WalkCompleteScreen';

type Stage = 'prep' | 'walking' | 'complete';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  /** WalkRouteResponse에 아직 route id가 없어 optional. 있으면 6d 즐겨찾기가 활성화된다. */
  routeId?: number;
  /** 시작 단계. 기본은 6a(산책 전)이지만, 이미 확인 절차를 거친 진입점은 6b부터 바로 시작할 수 있다. */
  initialStage?: Stage;
  onExitToHome: () => void;
}

/**
 * 6a(산책 전) → 6b(산책 중) → 6c(종료 확인) → 6d(완료)를 묶는 미니 플로우.
 * 아직 실제 네비게이션 스택이 없어 로컬 상태로 화면을 전환한다 —
 * 나중에 진짜 네비게이션이 생기면 이 컴포넌트 하나만 그 자리에 꽂으면 된다.
 */
export function WalkFlow({
  routeResult,
  currentLocation,
  routeId,
  initialStage = 'prep',
  onExitToHome,
}: Props) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [endConfirmVisible, setEndConfirmVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<WalkEndSnapshot | null>(null);

  if (stage === 'prep') {
    return (
      <WalkPrepScreen
        routeResult={routeResult}
        currentLocation={currentLocation}
        onStart={() => setStage('walking')}
        onBack={onExitToHome}
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
        />
        <WalkEndConfirmModal
          visible={endConfirmVisible}
          onCancel={() => setEndConfirmVisible(false)}
          onConfirm={() => {
            setEndConfirmVisible(false);
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
      traveledKm={snapshot?.traveledKm ?? 0}
      elapsedMs={snapshot?.elapsedMs ?? 0}
      routeId={routeId}
      onHome={onExitToHome}
    />
  );
}
