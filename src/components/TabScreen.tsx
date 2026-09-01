import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader } from './ScreenHeader';
import { BOTTOM_NAV_HEIGHT } from './BottomNav';
import { colors, spacing } from '../theme/tokens';

interface Props {
  title: string;
  children: React.ReactNode;
}

/**
 * 하단 탭(기록·마이페이지)의 공통 셸: 상단 헤더 + 스크롤 목록.
 * 하단 탭바에 콘텐츠가 가리지 않도록 아래쪽 여백을 잡아 둔다.
 */
export function TabScreen({ title, children }: Props) {
  return (
    <View style={styles.page}>
      <ScreenHeader title={title} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.card,
    paddingBottom: BOTTOM_NAV_HEIGHT,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.xxl,
    gap: spacing.md,
  },
});
