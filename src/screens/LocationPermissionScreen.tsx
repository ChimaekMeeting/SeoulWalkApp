import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing } from '../theme/tokens';

interface Props {
  status: 'undetermined' | 'denied';
  onRequest: () => void;
  onSkip: () => void;
}

export function LocationPermissionScreen({ status, onRequest, onSkip }: Props) {
  const isDenied = status === 'denied';

  const handlePrimary = isDenied ? () => Linking.openSettings() : onRequest;
  const primaryLabel = isDenied ? '설정에서 위치 권한 허용하기' : '위치 권한 허용';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <LocationPinIcon />
          <Text style={styles.title}>위치 권한이 필요해요</Text>
          <Text style={styles.body}>
            현재 위치 기준으로 경로와 날씨,{'\n'}
            대기질을 안내해요. ROUDI는 서울{'\n'}
            지역에서 이용할 수 있어요.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>위치 권한은 필수입니다</Text>
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
            <Text style={styles.secondaryButtonText}>직접 검색으로 위치 설정</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function LocationPinIcon() {
  return <Text style={{ fontSize: 64 }}>📍</Text>;
}

const PIN_COLOR = '#E05C6A';
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
  pinWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pinBall: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PIN_COLOR,
    zIndex: 1,
  },
  pinShine: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.45)',
    position: 'absolute',
    top: 12,
    left: 14,
  },
  pinTip: {
    width: 18,
    height: 18,
    backgroundColor: PIN_COLOR,
    transform: [{ rotate: '45deg' }],
    marginTop: -10,
    zIndex: 0,
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
