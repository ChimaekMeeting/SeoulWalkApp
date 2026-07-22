import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: string;
}

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerBack}>
          <Text style={styles.headerBackText}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerBody}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.headerRight}>{right}</Text> : null}
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
