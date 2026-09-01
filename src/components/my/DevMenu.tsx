import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { authStorage } from '../../auth/authStorage';

interface Props {
  onResetSurvey?: () => void;
}

/** 개발 빌드에서만 보이는 디버그 메뉴. 프로덕션(`__DEV__` false)에서는 아무것도 렌더하지 않는다. */
export function DevMenu({ onResetSurvey }: Props) {
  if (!__DEV__) {
    return null;
  }
  return (
    <View style={styles.group}>
      <Pressable
        style={styles.button}
        onPress={async () => {
          await authStorage.setAccessToken('invalid_token_for_test');
          Alert.alert('[DEV]', 'access_token을 잘못된 값으로 덮어씀');
        }}
      >
        <Text style={styles.buttonText}>[DEV] 토큰 강제 만료</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={onResetSurvey}>
        <Text style={styles.buttonText}>[DEV] 설문 화면 다시 보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    borderWidth: 1.5,
    borderColor: '#ff6b35',
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ff6b35',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
