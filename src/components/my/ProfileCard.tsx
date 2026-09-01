import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  nickname: string | null;
  email: string | null;
}

/** 마이페이지 상단의 프로필 요약 카드 (아바타 + 닉네임 + 카카오 이메일). */
export function ProfileCard({ nickname, email }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{nickname?.charAt(0) ?? '?'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{nickname ? `${nickname}님` : '사용자님'}</Text>
        <Text style={styles.email}>kakaoㆍ{email ?? '카카오 계정'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '900',
  },
  body: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  email: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
