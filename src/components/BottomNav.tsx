import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';
import { TabName } from '../navigation/types';

export const BOTTOM_NAV_HEIGHT = 76;

const navItems: { name: TabName; label: string; icon: string }[] = [
  { name: 'home', label: '홈', icon: '⌂' },
  { name: 'record', label: '기록', icon: '♧' },
  { name: 'me', label: '마이페이지', icon: '♙' },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: TabName;
  onChange: (tab: TabName) => void;
}) {
  // 폰 자체 뒤로가기/홈 제스처 바 영역에 탭바가 가려지지 않도록 하단 안전영역만큼 더 띄운다.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bottomNav,
        { height: BOTTOM_NAV_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {navItems.map(item => {
        const isActive = active === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => onChange(item.name)}
            style={styles.navItem}
          >
            <Text style={[styles.navIcon, isActive && styles.navActiveText]}>
              {item.icon}
            </Text>
            <Text style={[styles.navLabel, isActive && styles.navActiveText]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_NAV_HEIGHT,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navIcon: {
    color: colors.ink3,
    fontSize: 22,
    fontWeight: '900',
  },
  navLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: '800',
  },
  navActiveText: {
    color: colors.black,
  },
});
