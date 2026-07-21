import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';
import { radii, spacing } from '../theme/tokens';

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

  const primaryLabel = isDenied ? '설정에서 권한 허용하기' : '활동 인식 권한 허용';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.icon}>🏃</Text>
          <Text style={styles.title}>신체 활동 권한이 필요해요</Text>
          <Text style={styles.body}>
            걸음 수를 측정해 오늘의 활동량을{'\n'}
            기록하고 포인트를 적립해 드려요.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>만보계 기능에 필요한 권한이에요</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handlePrimary}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </Pressable>

          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>건너뛰기 (걸음 수 측정 안 됨)</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    color: '#111',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: '#9E9E9E',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 23,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    color: '#9E9E9E',
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
