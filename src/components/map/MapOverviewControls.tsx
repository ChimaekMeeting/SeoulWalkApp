import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { EnvironmentInfo } from '../../api/weather';
import { colors, radii, shadows, spacing } from '../../theme/tokens';

interface Props {
  environment: EnvironmentInfo | null;
  loading: boolean;
  onRecenter: () => void;
}

function numericValue(value?: string) {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function airGrade(environment: EnvironmentInfo | null) {
  const index = numericValue(environment?.air_info?.air_quality_index);
  if (index == null) return null;
  if (index <= 50) return '좋음';
  if (index <= 100) return '보통';
  if (index <= 250) return '나쁨';
  return '매우 나쁨';
}

function weatherIcon(environment: EnvironmentInfo | null) {
  const precipitation = environment?.weather_info?.precipitation_type ?? '';
  if (precipitation.includes('눈')) return 'snow-outline' as const;
  if (precipitation && precipitation !== '없음') return 'rainy-outline' as const;
  return 'partly-sunny-outline' as const;
}

export function MapOverviewControls({ environment, loading, onRecenter }: Props) {
  const temperature = environment?.weather_info?.temperature?.replace('℃', '°');
  const grade = airGrade(environment);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.brandBadge}>
        <Text style={styles.brand}>Roudi</Text>
      </View>

      <View style={styles.environmentCard} accessibilityLabel="현재 날씨와 대기질">
        <Ionicons name={weatherIcon(environment)} size={18} color={colors.ink} />
        <Text style={styles.value}>{loading ? '…' : temperature ?? '--'}</Text>
        <Text style={styles.label}>{loading ? '대기질' : `미세 ${grade ?? '--'}`}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="현재 위치로 이동"
        onPress={onRecenter}
        style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
      >
        <Ionicons name="locate" size={21} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: spacing.md,
    alignItems: 'flex-start',
    gap: 6,
    zIndex: 3,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    ...shadows.soft,
  },
  brand: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  environmentCard: {
    width: 36,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 1,
    paddingVertical: 4,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.soft,
  },
  value: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  label: {
    color: colors.inkFaint,
    fontSize: 7,
    fontWeight: '700',
    textAlign: 'center',
  },
  locationButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.soft,
  },
  pressed: {
    opacity: 0.72,
  },
});
