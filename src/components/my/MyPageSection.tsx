import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * 마이페이지의 카드형 섹션 컨테이너(제목 + 내용). '내 산책 취향'(MyPreferenceSection)·'지도 화면'
 * (MapAppearanceSection) 등 여러 섹션이 같은 배경·모서리·제목 스타일을 공유해서 뺐다.
 */
export function MyPageSection({ title, children, style }: Props) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

/** 섹션 안의 작은 소제목(예: '선호 거리', '홈 지도'). */
export function MyPageSubHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subHeading}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.containerBackground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  heading: {
    fontWeight: '900',
    fontSize: 16,
    color: colors.ink,
  },
  subHeading: {
    fontWeight: '800',
    fontSize: 14,
    color: colors.ink,
  },
});
