import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '../Text';
import { colors, spacing } from '../../theme/tokens';

// 다음 단계 문구로 넘어가는 간격. 실제 응답 시간과 무관하게 흘러가다 마지막 단계에서 멈춰
// 기다린다(steps가 다 떨어져도 로딩 자체는 sending이 풀릴 때까지 계속 보임).
const STEP_INTERVAL_MS = 2200;

type Props = {
  // 순서대로 보여줄 진행 상태 문구들. 백엔드가 실제 진행 단계를 내려주게 되면(현재는 미구현)
  // 그 값을 그대로 여기 꽂으면 된다 — 이 컴포넌트는 "문구 배열을 순서대로 보여주는 틀"만 담당.
  steps: string[];
};

export function LoadingBubble({ steps }: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
    if (steps.length <= 1) return;
    const timer = setInterval(() => {
      setStepIndex(prev => (prev + 1 < steps.length ? prev + 1 : prev));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  return (
    <View style={styles.chatLine}>
      <View style={styles.chatIcon}>
        <Text style={styles.chatIconText}>✳</Text>
      </View>
      <View style={styles.chatBubble}>
        <Animated.View
          key={stepIndex}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
        >
          <Text style={styles.chatText}>{steps[stepIndex]}</Text>
        </Animated.View>
        <ActivityIndicator size="small" color={colors.ink} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  chatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  chatBubble: {
    flexShrink: 1,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.containerBackground,
  },
  chatText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
