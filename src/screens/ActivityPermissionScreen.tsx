import React from 'react';
import { Linking } from 'react-native';
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
 * 걸음 수(만보계) 권한 안내 화면. 상태(undetermined/denied)는 AppBootstrap이 OS에 물어본
 * 결과를 prop으로 내려주고, 이 화면은 UI와 "요청/설정 열기" 버튼만 담당한다.
 *
 * 설정에서 권한을 켜고 돌아온 경우는 AppBootstrap의 포그라운드 재확인이 activityStatus를
 * granted로 바꿔 자동으로 다음 화면(Home)으로 넘기므로, 여기서 AppState를 직접 구독하지 않는다.
 */
export function ActivityPermissionScreen({ status, onGranted, onDenied, onSkip }: Props) {
  const isDenied = status === 'denied';

  const handlePrimary = isDenied
    ? () => Linking.openSettings()
    : async () => {
        const result = await requestPedometerPermission();
        if (result === 'granted') {
          onGranted();
        } else {
          onDenied();
        }
      };

  return (
    <PermissionPrompt
      icon="🏃"
      title="신체 활동 권한이 필요해요"
      body={'걸음 수를 측정해 오늘의 활동량을\n기록해 드려요.'}
      badgeText="만보계 기능에 필요한 권한이에요"
      primaryLabel={isDenied ? '설정에서 권한 허용하기' : '활동 인식 권한 허용'}
      onPrimary={handlePrimary}
      secondaryLabel="건너뛰기 (걸음 수 측정 안 됨)"
      onSecondary={onSkip}
    />
  );
}
