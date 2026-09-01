import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { MyPreferenceComponent } from '../components/my/MyPreferenceComponent';
import { SettingComponent } from '../components/my/SettingComponent';
import { colors, radii, spacing } from '../theme/tokens';
import { authStorage } from '../auth/authStorage';

interface MyPageScreenProps {
  onLogout?: () => void;
  nickname: string | null;
  email: string | null;
  onResetSurvey?: () => void;
}

export function MyPageScreen({
  onLogout,
  nickname,
  email,
  onResetSurvey,
}: MyPageScreenProps) {
  return (
    <View style={styles.pageSoft}>
      <ScreenHeader title="마이페이지" />
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{nickname?.charAt(0) ?? '?'}</Text>
          </View>
          <View style={styles.profileBody}>
            <Text style={styles.profileName}>{nickname ? `${nickname}님` : '사용자님'}</Text>
            <Text style={styles.profileEmail}>
              kakaoㆍ{email ?? '카카오 계정'}
            </Text>
          </View>
        </View>

        <MyPreferenceComponent />

        <SettingComponent
          label="신체 활동 및 위치 권한 수정"
          onPress={() => Linking.openSettings()}
        />
        <Pressable style={styles.menuRow} onPress={onLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>

        {__DEV__ && (
          <Pressable
            style={styles.devButton}
            onPress={async () => {
              await authStorage.setAccessToken('invalid_token_for_test');
              Alert.alert('[DEV]', 'access_token을 잘못된 값으로 덮어씀');
            }}
          >
            <Text style={styles.devButtonText}>[DEV] 토큰 강제 만료</Text>
          </Pressable>
        )}
        {__DEV__ && (
          <Pressable
            style={styles.devButton}
            onPress={onResetSurvey}
          >
            <Text style={styles.devButtonText}>[DEV] 설문 화면 다시 보기</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageSoft: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 76,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '900',
  },
  profileBody: {
    flex: 1,
  },
  profileName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  profileEmail: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  menuRow: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutText: {
    color: '#d75b5b',
    fontSize: 14,
    fontWeight: '800',
  },
  devButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    borderWidth: 1.5,
    borderColor: '#ff6b35',
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonText: {
    color: '#ff6b35',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
