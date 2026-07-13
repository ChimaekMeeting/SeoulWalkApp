import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { chatbotFlow, courses, PersonaId, personas } from '../data/chimeakData';
import { Navigate } from '../navigation/types';
import { ChatBubble } from '../components/chat/ChatBubble';
import { MyBubble } from '../components/chat/MyBubble';
import { spacing, colors, radii, shadows } from '../theme/tokens';

export function ChatScreen({
  persona,
  onSelectCourse,
  go,
}: {
  persona: PersonaId;
  onSelectCourse: (id: string) => void;
  go: Navigate;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const done = step >= chatbotFlow.length;
  const recommendType = answers[3]?.startsWith('편도') ? 'oneway' : 'loop';
  const recommended =
    courses.find(
      course =>
        course.type === recommendType && course.persona.includes(persona),
    ) ?? courses[0];

  const choose = (answer: string) => {
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    // (Optional) Could set filters here if needed
    setStep(current => current + 1);
  };

  return (
    <View style={styles.chatOverlay}>
      <View style={styles.chatSheet}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatHeaderTitle}>
            AI 산책 도우미 ({personas[persona].label})
          </Text>
          <Pressable onPress={() => go('home')} style={styles.chatCloseBtn}>
            <Text style={styles.chatCloseBtnText}>✕</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          <ChatBubble text="안녕하세요 채원님 👋" />
          <ChatBubble text="몇 가지만 물어볼게요. 오늘에 맞는 길을 찾아드릴게요." />
          {chatbotFlow
            .slice(0, Math.min(step + 1, chatbotFlow.length))
            .map((flow, index) => (
              <View key={flow.q}>
                <ChatBubble text={flow.q} />
                {answers[index] ? <MyBubble text={answers[index]} /> : null}
                {index === step && !done ? (
                  <View style={styles.answerRow}>
                    {flow.a.map(answer => (
                      <Pressable
                        key={answer}
                        onPress={() => choose(answer)}
                        style={styles.answerChip}
                      >
                        <Text style={styles.answerText}>{answer}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          {done ? (
            <View>
              <ChatBubble text="좋아요. 정리해보면 오늘은 이 길이 어울려요." />
              <Pressable
                onPress={() => {
                  onSelectCourse(recommended.id);
                  go('home');
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
                    style={[styles.recommendType, { color: recommended.color }]}
                  >
                    {recommended.type === 'loop'
                      ? '순환 · LOOP'
                      : '편도 · ONE-WAY'}
                  </Text>
                  <Text style={styles.recommendTitle}>{recommended.title}</Text>
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
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatContent: {
    padding: spacing.lg,
    paddingBottom: 108,
    gap: spacing.md,
  },
  answerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: 38,
  },
  answerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.mint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  answerText: {
    color: colors.mintDeep,
    fontSize: 12,
    fontWeight: '900',
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
  chatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  chatSheet: {
    height: '80%',
    backgroundColor: colors.bgSoft,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...shadows.soft,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  chatCloseBtn: {
    padding: spacing.sm,
  },
  chatCloseBtnText: {
    fontSize: 20,
    color: colors.ink3,
    fontWeight: '700',
  },
});
