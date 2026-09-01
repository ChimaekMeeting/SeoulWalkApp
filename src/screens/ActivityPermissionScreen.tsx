import React from 'react';
import { PermissionPrompt } from '../components/PermissionPrompt';
import { requestPedometerPermission } from '../auth/permissions';

interface Props {
  /** AppBootstrap의 activityStatus를 그대로 받는다 */
  status: 'undetermined' | 'denied';
  onGranted: () => void;
  onDenied: () => void;
  onSkip: () => void;
}

/**
 * 걸음 수(만보계) 권한 안내 화면. 상태는 AppBootstrap이 OS 조회 결과를 prop으로 내려주고,
 * 설정에서 켜고 돌아온 경우도 AppBootstrap의 포그라운드 재확인이 처리하므로 여기서 AppState를
 * 직접 구독하지 않는다. denied → 설정 열기 분기는 PermissionPrompt가 담당한다.
 */
export function ActivityPermissionScreen({ status, onGranted, onDenied, onSkip }: Props) {
  return (
    <PermissionPrompt
      icon="🏃"
      title="신체 활동 권한이 필요해요"
      body={'걸음 수를 측정해 오늘의 활동량을\n기록해 드려요.'}
      badgeText="만보계 기능에 필요한 권한이에요"
      status={status}
      requestLabel="활동 인식 권한 허용"
      openSettingsLabel="설정에서 권한 허용하기"
      onRequest={async () => {
        const result = await requestPedometerPermission();
        if (result === 'granted') onGranted();
        else onDenied();
      }}
      secondaryLabel="건너뛰기 (걸음 수 측정 안 됨)"
      onSecondary={onSkip}
    />
  );
}
