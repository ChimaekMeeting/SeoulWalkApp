import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { colors, radii, spacing } from '../../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** 문구/버튼 커스터마이즈 — 기본값은 "조기 종료 확인". 완주 확인 등 다른 맥락에서 재사용한다. */
  icon?: string;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function WalkEndConfirmModal({
  visible,
  onCancel,
  onConfirm,
  icon = '🚶',
  title = '산책을 정말로\n종료하시겠습니까?',
  subtitle = '기록은 자동으로 저장돼요',
  confirmLabel = '종료',
  cancelLabel = '아니요',
}: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // 폰 자체 뒤로가기/홈 제스처 바에 버튼이 가려지지 않도록 하단 안전영역만큼 더 띄운다.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: spacing.xxl + insets.bottom, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.dragHandle} />
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.actionRow}>
            <Button label={cancelLabel} onPress={onCancel} variant="secondary" style={styles.flexButton} />
            <Button label={confirmLabel} onPress={onConfirm} style={styles.flexButton} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    color: colors.inkMuted,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  flexButton: {
    flex: 1,
  },
});
