import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';

// App.tsx의 LoadingScreen(브랜드 스플래시 다음에 뜨는 로딩 화면)도 같은 배경색을 써서
// 두 화면 전환이 색 변화 없이 자연스럽게 이어지도록 export한다.
export const BRAND_SPLASH_BG = '#0D0D0D';
const BG = BRAND_SPLASH_BG;

export function BrandSplashScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <FootprintsIcon />
      <Text style={styles.logo}>ROUDI</Text>
      <Text style={styles.tagline}>AI 산책 경로 추천 · 서울</Text>
    </View>
  );
}

function FootprintsIcon() {
  return <Text style={styles.footEmoji}>👣</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  footEmoji: {
  fontSize: 48,
  marginBottom: 8,
  },
  logo: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
