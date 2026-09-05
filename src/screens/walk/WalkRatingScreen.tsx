import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { colors, radii, spacing } from '../../theme/tokens';
import { WalkRatings } from '../../types/walk';

interface Props {
  /** 네 항목 별점을 모두 매기고 "완료"를 누르면 호출된다. */
  onSubmit: (ratings: WalkRatings) => void;
}

const QUESTIONS: { key: keyof WalkRatings; label: string }[] = [
  { key: 'nature', label: '자연을 가까이 느끼며 걸을 수 있어서 좋았나요?' },
  { key: 'safety', label: '걷는 내내 안전하다고 느낄 수 있어서 좋았나요?' },
  { key: 'comfort', label: '몸도 마음도 편하게 걸을 수 있어서 좋았나요?' },
  { key: 'overall', label: '전체적으로 얼마나 마음에 드셨나요?' },
];

const EMPTY: WalkRatings = { nature: 0, safety: 0, comfort: 0, overall: 0 };

// 완료 화면(6d) → 이 화면(6e) → 홈. 네 항목을 모두 매겨야 "완료"가 활성화된다.
export function WalkRatingScreen({ onSubmit }: Props) {
  const [ratings, setRatings] = useState<WalkRatings>(EMPTY);
  const complete = QUESTIONS.every(q => ratings[q.key] > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Text style={styles.title}>이번 산책로,{'\n'}얼마나 마음에 드셨나요?</Text>
      <Text style={styles.subtitle}>좋았던 점을 별점으로 남겨주세요.</Text>

      <View style={styles.list}>
        {QUESTIONS.map(q => (
          <View key={q.key} style={styles.row}>
            <Text style={styles.rowLabel}>{q.label}</Text>
            <StarRating
              value={ratings[q.key]}
              onChange={score => setRatings(prev => ({ ...prev, [q.key]: score }))}
            />
          </View>
        ))}
      </View>

      <Button
        label="완료"
        onPress={() => onSubmit(ratings)}
        disabled={!complete}
        style={styles.submit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xxl,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 36,
    marginTop: spacing.xxl,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  row: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  submit: {
    marginTop: 'auto',
    marginBottom: spacing.xxl,
  },
});
