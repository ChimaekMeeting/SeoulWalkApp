import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onboardingStorage } from '../auth/onboardingStorage';
import { Button } from '../components/Button';
import { colors, spacing } from '../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🗺️',
    title: '말만 하면\n딱 맞는 산책길을\n찾아드려요',
    subtitle: '“30분 조용한 공원 코스”처럼 편하게\n말하면 AI가 경로를 추천해요',
  },
  {
    icon: '🌦️',
    title: '날씨·대기질까지\n고려한 똑똑한 추천',
    subtitle: '해질녘엔 노을 코스, 미세먼지 많은\n날엔 실내 가까운 길로 — 지금\n상황에 맞게',
  },
  {
    icon: '🚶',
    title: '산책 중에도\nAI가 곁에서 안내해요',
    subtitle: '진행률·거리를 실시간으로 보고, 예쁜\n카페가 있으면 살짝 알려드려요',
  },
] as const;

interface Props {
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sliderH, setSliderH] = useState(0);
  const isLast = currentIndex === SLIDES.length - 1;

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setCurrentIndex(index);
  };

  const goNext = () => {
    const next = currentIndex + 1;
    scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    setCurrentIndex(next);
  };

  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // 시작하기·건너뛰기 모두 이 함수를 쓴다. 저장이 실제로 검증될 때까지 onDone()을 호출하지
  // 않는다 — 저장 안 된 채 다음 화면으로 넘어가면 앱을 껐다 켤 때 온보딩이 다시 나온다.
  const finish = async () => {
    if (isFinishing) return;

    setIsFinishing(true);
    setFinishError(null);

    try {
      const saved = await onboardingStorage.markSeen();

      if (!saved) {
        console.warn('[Onboarding] has_seen_onboarding 저장/검증 실패 — 온보딩 화면 유지');
        setFinishError('설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      onDone();
    } catch (error) {
      console.warn('[Onboarding] 완료 처리 실패:', error);
      setFinishError('완료 처리에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.sliderWrap} onLayout={e => setSliderH(e.nativeEvent.layout.height)}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {SLIDES.map((slide, i) => (
            <View key={i} style={[styles.slide, { height: sliderH }]}>
              <Text style={styles.slideIcon}>{slide.icon}</Text>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label={isLast ? '시작하기' : '다음'}
            onPress={isLast ? finish : goNext}
            loading={isLast && isFinishing}
          />

          <Pressable
            onPress={finish}
            disabled={isFinishing}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>

          {finishError && <Text style={styles.errorText}>{finishError}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  sliderWrap: {
    flex: 1,
  },
  slide: {
    width: SCREEN_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  slideIcon: {
    fontSize: 80,
  },
  slideTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 36,
  },
  slideSubtitle: {
    color: colors.inkMuted,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 23,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D9D9D9',
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.ink,
  },
  actions: {
    gap: spacing.sm,
  },
  skipButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: colors.inkMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
