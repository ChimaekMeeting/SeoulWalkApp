import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '../../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WalkEndConfirmModal({ visible, onCancel, onConfirm }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.dragHandle} />
          <Text style={styles.icon}>🚶</Text>
          <Text style={styles.title}>산책을 정말로{'\n'}종료하시겠습니까?</Text>
          <Text style={styles.subtitle}>기록은 자동으로 저장돼요</Text>
          <View style={styles.actionRow}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.cancelButtonText}>아니요</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.confirmButtonText}>종료</Text>
            </Pressable>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#E0E0E0',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
