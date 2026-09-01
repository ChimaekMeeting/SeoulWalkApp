import React from 'react';
import { Linking } from 'react-native';
import { PermissionPrompt } from '../components/PermissionPrompt';

interface Props {
  status: 'undetermined' | 'denied';
  onRequest: () => void;
  onSkip: () => void;
}

export function LocationPermissionScreen({ status, onRequest, onSkip }: Props) {
  const isDenied = status === 'denied';

  return (
    <PermissionPrompt
      icon="📍"
      title="위치 권한이 필요해요"
      body={
        '현재 위치 기준으로 경로와 날씨,\n대기질을 안내해요. ROUDI는 서울\n지역에서 이용할 수 있어요.'
      }
      badgeText="위치 권한은 필수입니다"
      primaryLabel={isDenied ? '설정에서 위치 권한 허용하기' : '위치 권한 허용'}
      onPrimary={isDenied ? () => Linking.openSettings() : onRequest}
      secondaryLabel="직접 검색으로 위치 설정"
      onSecondary={onSkip}
    />
  );
}
