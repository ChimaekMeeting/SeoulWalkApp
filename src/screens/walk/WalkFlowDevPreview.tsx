import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { WalkFlow } from './WalkFlow';
import { WalkMode, WalkRouteResponse, WalkRouteStatus } from '../../types/prewalk';

const MOCK_ROUTE_RESULT: WalkRouteResponse = {
  status: WalkRouteStatus.SUCCESS,
  mode: WalkMode.CIRCULAR_RANDOM,
  total_km: 1.2,
  coordinates: [
    [37.5665, 126.978],
    [37.567, 126.979],
    [37.566, 126.98],
    [37.565, 126.981],
  ],
};
const MOCK_LOCATION = { lat: 37.5665, lon: 126.978, address: null, place_name: null };

/**
 * __DEV__ 전용 미리보기 버튼. 프리워크 챗봇 플로우가 아직 WalkFlow에 연결되기 전이라,
 * mock 데이터로 6a~6d를 바로 열어볼 수 있게 해준다. 프로덕션 빌드에서는 렌더되지 않는다.
 */
export function WalkFlowDevPreview() {
  const [visible, setVisible] = useState(false);

  if (!__DEV__) return null;

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setVisible(true)}>
        <Text style={styles.fabText}>🚶</Text>
      </Pressable>
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <WalkFlow
          routeResult={MOCK_ROUTE_RESULT}
          currentLocation={MOCK_LOCATION}
          onExitToHome={() => setVisible(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 10,
  },
  fabText: {
    fontSize: 22,
  },
});
