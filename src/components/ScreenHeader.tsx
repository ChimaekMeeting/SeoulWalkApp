import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: string;
  /** 배경/하단 보더가 없는 투명 헤더 (전체화면 플로우용) */
  plain?: boolean;
  align?: 'left' | 'center';
}

export function ScreenHeader({ title, subtitle, onBack, right, plain, align = 'left' }: Props) {
  const centered = align === 'center';
  return (
    <View style={[styles.header, plain && styles.headerPlain]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerBack}>
          <Text style={styles.headerBackText}>‹</Text>
        </Pressable>
      ) : centered ? (
        <View style={styles.headerBack} />
      ) : null}
      <View style={[styles.headerBody, centered && styles.headerBodyCentered]}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <Text style={styles.headerRight}>{right}</Text>
      ) : centered && onBack ? (
        <View style={styles.headerBack} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerPlain: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headerBack: {
    marginLeft: -spacing.sm,
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '500',
  },
  headerBody: {
    flex: 1,
  },
  headerBodyCentered: {
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  headerRight: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '800',
  },
});
