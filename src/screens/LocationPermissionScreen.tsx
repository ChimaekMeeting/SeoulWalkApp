import React from 'react';
import { PermissionPrompt } from '../components/PermissionPrompt';

interface Props {
  status: 'undetermined' | 'denied';
  onRequest: () => void;
}

/**
 * 위치 권한은 앱 사용에 필수라 "건너뛰기"가 없다. denied → 설정 열기 분기는 PermissionPrompt가
 * 처리한다. 설정에서 켜고 돌아오면 AppBootstrap의 포그라운드 재확인이 자동으로 다음 단계로 넘긴다.
 */
export function LocationPermissionScreen({ status, onRequest }: Props) {
  return (
    <PermissionPrompt
      icon="📍"
      title="위치 권한이 필요해요"
      body={
        '현재 위치 기준으로 경로와 날씨,\n대기질을 안내해요. ROUDI는 서울\n지역에서 이용할 수 있어요.'
      }
      badgeText="위치 권한은 필수입니다"
      status={status}
      requestLabel="위치 권한 허용"
      openSettingsLabel="설정에서 위치 권한 허용하기"
      onRequest={onRequest}
    />
  );
}
