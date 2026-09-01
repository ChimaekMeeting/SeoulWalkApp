import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

/** 로그인·설문 등에서 쓰는 붉은 인라인 에러 박스. message가 없으면 아무것도 렌더하지 않는다. */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.md,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.md,
  },
  text: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
