import React, { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import { TabName } from '../navigation/types';

export const BOTTOM_NAV_HEIGHT = 60;

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const navItems: {
  name: TabName;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}[] = [
  { name: 'home', label: '홈', icon: 'home-outline', activeIcon: 'home' },
  { name: 'record', label: '기록', icon: 'time-outline', activeIcon: 'time' },
  { name: 'me', label: '마이페이지', icon: 'person-outline', activeIcon: 'person' },
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
      collapsable={false}
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
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(item.name)}
            style={styles.navItem}
          >
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={20}
              color={isActive ? colors.ink : colors.ink3}
            />
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
    paddingBottom: 2,
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
    gap: 0,
  },
  navLabel: {
    color: colors.ink3,
    fontSize: 9,
    fontWeight: '800',
  },
  navActiveText: {
    color: colors.ink,
  },
});
