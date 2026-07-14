import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing } from '../theme/tokens';

interface Props {
  onLogin: () => void;
  error?: string | null;
}

export function LoginScreen({ onLogin, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.footIcon}>👣</Text>
            <Text style={styles.appName}>ROUDI</Text>
            <Text style={styles.tagline}>오늘도 걸어볼까요?</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>이메일</Text>
              <TextInput
                style={styles.input}
                placeholder="name@email.com"
                placeholderTextColor="#BDBDBD"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>비밀번호</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#BDBDBD"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.loginButtonText}>로그인</Text>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>또는</Text>
              <View style={styles.orLine} />
            </View>

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

            <Pressable
              style={({ pressed }) => [
                styles.guestButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.guestButtonText}>로그인 없이 둘러보기 (게스트)</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 56,
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
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
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
  loginButton: {
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  orText: {
    color: '#9E9E9E',
    fontSize: 13,
    fontWeight: '600',
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
  guestButton: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#C8C8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
