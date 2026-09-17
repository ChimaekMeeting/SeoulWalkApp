import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radii, spacing } from '../theme/tokens';

interface Props {
  /** "설정에서 항상 허용으로 바꿔주세요" 안내로 바꿀지 — request()가 실패(denied)했을 때 true. */
  needsSettings: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

/**
 * 산책 준비(WalkPrepScreen) 화면에 뜨는 1회성 제안 배너 — "화면을 꺼도 안내받기"를 켤지 물어본다.
 * 백그라운드 위치 권한이 아직 없을 때만 띄우고, "나중에"를 누르면 그 산책 준비에서는 다시 안
 * 띄운다(다음 산책에서는 다시 물어봄 — 매번 강제하지 않되 스팸도 안 되게). 거부해도 화면 켜진
 * 동안의 턴바이턴 안내(Phase A)는 walking 화면에서 그대로 동작한다.
 */
export function BackgroundGuidancePrompt({
  needsSettings,
  onAllow,
  onOpenSettings,
  onDismiss,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>화면을 꺼도 경로 안내를 받을까요?</Text>
      <Text style={styles.body}>
        {needsSettings
          ? '설정 앱에서 위치 권한을 "항상 허용"으로 바꾸면, 화면이 꺼지거나 다른 앱을 쓰는 동안에도 턴 안내가 이어져요.'
          : '위치 권한을 "항상 허용"하면 화면이 꺼지거나 다른 앱을 쓰는 동안에도 턴 안내가 이어져요.'}
      </Text>
      <View style={styles.actions}>
        <Button
          label="나중에"
          variant="secondary"
          onPress={onDismiss}
          style={styles.actionButton}
        />
        <Button
          label={needsSettings ? '설정 열기' : '허용하기'}
          onPress={needsSettings ? onOpenSettings : onAllow}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.inkFaint,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
    height: 40,
  },
});
