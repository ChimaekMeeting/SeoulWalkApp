import { ActivityIndicator, View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '../Text';
import { colors, spacing } from '../../theme/tokens';
import { AssistantAvatar } from './AssistantAvatar';

type Props = {
  // 지금까지 서버(SSE progress 이벤트)가 보내온 진행 상태 문구들, 도착 순서대로 누적된 배열.
  // 항상 마지막(가장 최근) 문구만 보여준다.
  steps: string[];
};

export function LoadingBubble({ steps }: Props) {
  const current = steps[steps.length - 1];

  return (
    <View style={styles.chatLine}>
      <AssistantAvatar />
      <View style={styles.chatBubble}>
        <Animated.View
          key={current}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
        >
          <Text style={styles.chatText}>{current}</Text>
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
