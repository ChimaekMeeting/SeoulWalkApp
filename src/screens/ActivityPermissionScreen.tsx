import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { PermissionPrompt } from '../components/PermissionPrompt';

interface Props {
  status: 'undetermined' | 'denied';
  onGranted: () => void;
  onSkip: () => void;
}

export function ActivityPermissionScreen({ status, onGranted, onSkip }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isDenied = currentStatus === 'denied';

  const checkPermission = async () => {
    const { status: s } = await Pedometer.getPermissionsAsync();
    if (s === 'granted') {
      onGranted();
    } else {
      setCurrentStatus('denied');
    }
  };

  // 설정 앱에서 돌아왔을 때 권한 상태 재확인
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appState.current !== 'active' &&
        nextState === 'active' &&
        currentStatus === 'denied'
      ) {
        checkPermission();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [currentStatus]);

  const handlePrimary = isDenied
    ? () => Linking.openSettings()
    : async () => {
        const { status: s } = await Pedometer.requestPermissionsAsync();
        if (s === 'granted') {
          onGranted();
        } else {
          setCurrentStatus('denied');
        }
      };

  return (
    <PermissionPrompt
      icon="🏃"
      title="신체 활동 권한이 필요해요"
      body={
        '걸음 수를 측정해 오늘의 활동량을\n기록하고 포인트를 적립해 드려요.'
      }
      badgeText="만보계 기능에 필요한 권한이에요"
      primaryLabel={isDenied ? '설정에서 권한 허용하기' : '활동 인식 권한 허용'}
      onPrimary={handlePrimary}
      secondaryLabel="건너뛰기 (걸음 수 측정 안 됨)"
      onSecondary={onSkip}
    />
  );
}
