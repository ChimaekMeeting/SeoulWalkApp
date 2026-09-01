import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';
import { Button } from './Button';

interface Props {
  /** 이모지 하나 (64pt로 표시) */
  icon: string;
  title: string;
  /** 여러 줄이면 '\n' 포함 */
  body: string;
  badgeText: string;
  /** 'denied'면 primary 버튼이 자동으로 "설정 열기"가 된다(OS가 다이얼로그를 다시 못 띄우므로). */
  status: 'undetermined' | 'denied';
  /** status가 undetermined일 때의 primary 버튼 */
  requestLabel: string;
  onRequest: () => void;
  /** status가 denied일 때의 primary 버튼 라벨 (동작은 항상 설정 열기) */
  openSettingsLabel: string;
  /** 보조 버튼은 선택 — 없으면(위치 권한처럼 필수) primary 버튼만 렌더한다. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * 위치·신체활동 등 권한 요청 화면의 공통 레이아웃 + "denied면 설정 열기" 분기까지 담는다.
 * 각 화면은 문구와 요청 동작만 넘기면 된다.
 */
export function PermissionPrompt({
  icon,
  title,
  body,
  badgeText,
  status,
  requestLabel,
  onRequest,
  openSettingsLabel,
  secondaryLabel,
  onSecondary,
}: Props) {
  const isDenied = status === 'denied';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label={isDenied ? openSettingsLabel : requestLabel}
            onPress={isDenied ? () => Linking.openSettings() : onRequest}
          />
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
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
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: colors.inkMuted,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 23,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
  },
});
