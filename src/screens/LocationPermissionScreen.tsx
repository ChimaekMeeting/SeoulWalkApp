import React from 'react';
import { Linking } from 'react-native';
import { PermissionPrompt } from '../components/PermissionPrompt';

interface Props {
  status: 'undetermined' | 'denied';
  onRequest: () => void;
}

/**
 * 위치 권한은 앱 사용에 필수라 "건너뛰기"가 없다.
 * - undetermined: OS 권한 요청
 * - denied: OS 다이얼로그를 다시 못 띄우므로 설정 화면으로 안내
 * 설정에서 켜고 돌아오면 AppBootstrap의 포그라운드 재확인이 자동으로 다음 단계로 넘긴다.
 */
export function LocationPermissionScreen({ status, onRequest }: Props) {
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
    />
  );
}
