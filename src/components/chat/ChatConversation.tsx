import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import {
  chatbotFlow,
  courses,
  PersonaId,
  personas,
} from '../../data/chimeakData';
import { Navigate } from '../../navigation/types';
import { ChatBubble } from './ChatBubble';
import { MyBubble } from './MyBubble';
import { spacing, colors, radii } from '../../theme/tokens';

export type ChatConversationHandle = {
  submitAnswer: (answer: string) => void;
};

type Props = {
  persona: PersonaId;
  onSelectCourse: (id: string) => void;
  go: Navigate;
  onRequestClose: () => void; // ✕ 또는 코스 선택 시 시트를 접는 콜백
  onDoneChange: (done: boolean) => void; // 질문이 모두 끝났는지를 외부(입력창)에 알림
  bottomInset: number; // 바텀시트 바깥에 떠 있는 ChatInput에 가려지지 않도록 남겨둘 여백
  // 헤더 + 인사말 2개 + 첫 질문(=말풍선 2~3개)의 실측 높이를 부모(중간 스냅 계산)에 전달.
  // 대화가 길어져도 이 미리보기 묶음 자체의 크기는 바뀌지 않아, 중간 스냅이 항상 같은
  // 위치(말풍선이 잘리지 않는 위치)를 가리키게 된다.
  onPreviewHeightChange: (height: number) => void;
};

// 홈 바텀시트 안에 들어가는 채팅 대화 패널 (오버레이/배경 없이 시트가 컨테이너 역할)
// 입력창(ChatInput)은 바텀시트 바깥에 떠 있는 별도 요소라 submitAnswer를 ref로 노출해 연결한다.
export const ChatConversation = forwardRef(function ChatConversation(
  {
    persona,
    onSelectCourse,
    go,
    onRequestClose,
    onDoneChange,
    bottomInset,
    onPreviewHeightChange,
  }: Props,
  ref: React.Ref<ChatConversationHandle>,
) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [previewGroupHeight, setPreviewGroupHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const done = step >= chatbotFlow.length;
  const recommendType = answers[3]?.startsWith('편도') ? 'oneway' : 'loop';
  const recommended =
    courses.find(
      course =>
        course.type === recommendType && course.persona.includes(persona),
    ) ?? courses[0];

  const choose = (answer: string) => {
    setAnswers([...answers, answer]);
    setStep(current => current + 1);
  };

  useEffect(() => {
    onDoneChange(done);
  }, [done, onDoneChange]);

  useEffect(() => {
    // previewGroupHeight는 스크롤 여백(padding)을 뺀 순수 콘텐츠 높이라,
    // 위쪽 padding(spacing.lg)만 더하면 "미리보기 영역이 실제로 차지하는 높이"가 된다.
    onPreviewHeightChange(headerHeight + previewGroupHeight + spacing.lg);
  }, [headerHeight, previewGroupHeight, onPreviewHeightChange]);

  useImperativeHandle(ref, () => ({
    submitAnswer: (answer: string) => {
      if (done) return;
      choose(answer);
    },
  }));

  return (
    <View style={styles.chatPanel}>
      <View
        style={styles.chatHeader}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <Text style={styles.chatHeaderTitle}>
          AI 산책 도우미 ({personas[persona].label})
        </Text>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={[
          styles.chatContent,
          { paddingBottom: bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        // 말풍선이 추가/삭제되어 콘텐츠 높이가 바뀔 때마다(=맨 아래 높이가 바뀔 때마다)
        // 그 높이를 기준으로 맨 아래로 자동 스크롤한다.
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        <View style={styles.bubbleStack}>
          <View
            style={styles.previewGroup}
            onLayout={e =>
              setPreviewGroupHeight(e.nativeEvent.layout.height)
            }
          >
            <ChatBubble text="안녕하세요 채원님 👋" />
            <ChatBubble text="몇 가지만 물어볼게요. 오늘에 맞는 길을 찾아드릴게요." />
            <ChatBubble text={chatbotFlow[0].q} />
          </View>
          {answers[0] ? <MyBubble text={answers[0]} /> : null}
          {chatbotFlow
            .slice(1, Math.min(step + 1, chatbotFlow.length))
            .map((flow, offset) => {
              const index = offset + 1;
              return (
                <View key={flow.q}>
                  <ChatBubble text={flow.q} />
                  {answers[index] ? <MyBubble text={answers[index]} /> : null}
                </View>
              );
            })}
          {done ? (
            <View>
              <ChatBubble text="좋아요. 정리해보면 오늘은 이 길이 어울려요." />
              <Pressable
                onPress={() => {
                  onSelectCourse(recommended.id);
                  onRequestClose();
                }}
                style={styles.recommendBubble}
              >
                <View
                  style={[
                    styles.recommendIcon,
                    { backgroundColor: `${recommended.color}22` },
                  ]}
                >
                  <Text style={styles.recommendMood}>{recommended.mood}</Text>
                </View>
                <View style={styles.recommendBody}>
                  <Text
                    style={[
                      styles.recommendType,
                      { color: recommended.color },
                    ]}
                  >
                    {recommended.type === 'loop'
                      ? '순환 · LOOP'
                      : '편도 · ONE-WAY'}
                  </Text>
                  <Text style={styles.recommendTitle}>
                    {recommended.title}
                  </Text>
                  <Text style={styles.recommendMeta}>
                    {recommended.distance}km · {recommended.duration}분 ·{' '}
                    {recommended.kcal}kcal
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <View style={styles.chatButtons}>
                <Pressable
                  onPress={() => go('courses')}
                  style={styles.primaryButtonSmall}
                >
                  <Text style={styles.primaryButtonText}>
                    다른 코스 더 보기
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAnswers([]);
                    setStep(0);
                  }}
                  style={styles.ghostButtonSmall}
                >
                  <Text style={styles.ghostButtonText}>다시 묻기</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  chatPanel: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: spacing.lg,
  },
  bubbleStack: {
    gap: spacing.md,
  },
  previewGroup: {
    gap: spacing.md,
  },
  recommendBubble: {
    marginLeft: 38,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recommendIcon: {
    width: 62,
    height: 62,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendMood: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  recommendBody: {
    flex: 1,
  },
  recommendType: {
    fontSize: 11,
    fontWeight: '900',
  },
  recommendTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  recommendMeta: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  chevron: {
    color: colors.ink3,
    fontSize: 28,
  },
  chatButtons: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.mintDeep,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  ghostButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  ghostButtonText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '900',
  },
});
