import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type BackgroundLocationStatus = 'granted' | 'denied' | 'undetermined' | 'checking';

/**
 * 백그라운드 위치("항상 허용") 권한 상태 조회·요청. 포그라운드 위치는 이미 필수 온보딩에서 받는다는
 * 전제(src/auth/permissions.ts) — 여기선 그 위에 선택적으로 얹는 "항상 허용"만 다룬다(백그라운드
 * 턴바이턴 지속은 선택 기능 — 거부해도 화면 안내는 그대로 동작).
 *
 * 안드로이드 11+는 "항상 허용"을 OS 다이얼로그 한 번으로 못 받는다 — "앱 사용 중"이 이미 허용된
 * 상태에서 requestBackgroundPermissionsAsync를 불러도 대부분 'denied'가 돌아오고, 사용자가 직접
 * 설정 앱에서 "항상 허용"으로 바꿔야 한다. 그래서 request()가 실패하면 호출부가 openSettings()로
 * 유도해야 한다.
 *
 * 알림 권한(안드로이드 13+ 런타임 권한, iOS는 버전 무관 항상 필요)도 이 기능에 필수라 같이 요청한다
 * — 알림이 없으면 백그라운드 턴 안내 자체가 뜰 수단이 없다.
 */
export function useBackgroundLocationPermission() {
  const [status, setStatus] = useState<BackgroundLocationStatus>('checking');

  const refresh = useCallback(async () => {
    try {
      const { status: s } = await Location.getBackgroundPermissionsAsync();
      setStatus(s as BackgroundLocationStatus);
    } catch {
      setStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = useCallback(async (): Promise<boolean> => {
    try {
      const [{ status: locationStatus }, { status: notificationStatus }] = await Promise.all([
        Location.requestBackgroundPermissionsAsync(),
        Notifications.requestPermissionsAsync(),
      ]);
      setStatus(locationStatus as BackgroundLocationStatus);
      return locationStatus === 'granted' && notificationStatus === 'granted';
    } catch {
      setStatus('undetermined');
      return false;
    }
  }, []);

  return {
    status,
    granted: status === 'granted',
    refresh,
    request,
    openSettings: () => Linking.openSettings(),
  };
}
