import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onboardingStorage } from '../auth/onboardingStorage';
import { Button } from '../components/Button';
import { colors, spacing } from '../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🗺️',
    title: '말만 하면\n딱 맞는 산책길을\n찾아드려요',
    subtitle: '“30분 편안한 공원 코스”처럼 편하게 말하면 AI가 경로를 추천해요',
  },
  {
    icon: '🚶',
    title: '안전 모드, 편안 모드\n원하는 스타일로 골라요',
    subtitle: '조명 많은 안전한 길, 여유로운 편안한 길 — 내 취향에 맞는 모드로 산책로를 골라요',
  },
  {
    icon: '⭐',
    title: '산책 후 평가하면\n다음 추천이 더 좋아져요',
    subtitle: '산책 후 별점을 남기면 내 취향에 맞춰 갈수록 나에게 딱 맞는 코스를 추천해요',
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
