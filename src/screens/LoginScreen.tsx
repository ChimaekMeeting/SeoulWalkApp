import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing } from '../theme/tokens';

interface Props {
  onLogin: () => void;
  error?: string | null;
}

export function LoginScreen({ onLogin, error }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.footIcon}>👣</Text>
          <Text style={styles.appName}>ROUDI</Text>
          <Text style={styles.tagline}>오늘도 걸어볼까요?</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onLogin}
            style={({ pressed }) => [
              styles.kakaoButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.kakaoIcon}>💬</Text>
            <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
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
  body: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 40,
    gap: spacing.sm,
  },
  footIcon: {
    fontSize: 52,
  },
  appName: {
    color: '#111',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  tagline: {
    color: '#9E9E9E',
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  errorBox: {
    borderRadius: radii.md,
    backgroundColor: '#fde8e8',
    borderWidth: 1,
    borderColor: '#f5c6c6',
    padding: spacing.md,
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  kakaoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#FEE500',
  },
  kakaoIcon: {
    fontSize: 20,
  },
  kakaoButtonText: {
    color: '#191919',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
