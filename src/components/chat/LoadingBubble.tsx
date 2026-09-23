import { ActivityIndicator, View, StyleSheet } from 'react-native';
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
        {/* 이전엔 문구가 바뀔 때마다 FadeIn/FadeOut을 같이 걸었는데, Reanimated가 exiting
            뷰를 그 자리에 절대 위치로 남겨둔 채 다음 뷰를 그려서 두 문구가 겹쳐 보였다
            (레이아웃이 알아서 밀어주는 컴포넌트가 아니라서). 애니메이션 없이 바로 교체한다. */}
        <Text style={styles.chatText}>{current}</Text>
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
