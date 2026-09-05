import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { postSurvey } from '../api/survey';
import { surveyCompletedStorage } from '../auth/onboardingStorage';
import { SURVEY_TAGS } from '../config/surveyOptions';
import { DistanceOption } from '../types/survey';
import { Button } from '../components/Button';
import { DistanceSelector } from '../components/DistanceSelector';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radii, spacing } from '../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');
const CHIP_GAP = spacing.sm;
const CHIP_W = (SCREEN_W - spacing.xxl * 2 - CHIP_GAP * 2) / 3;

interface Props {
  onDone: () => void;
}

export function SurveyScreen({ onDone }: Props) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [distance, setDistance] = useState<DistanceOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleTag = (tagValue: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tagValue) ? next.delete(tagValue) : next.add(tagValue);
      return next;
    });
  };

  const handleComplete = async () => {
    setLoading(true);
    setErrorMsg(null);
    const payload = { tags: Array.from(selectedTags), distance };
    console.log('[SurveyScreen] POST /api/user/survey 요청:', payload);
    try {
      const res = await postSurvey(payload);
      console.log('[SurveyScreen] POST /api/user/survey 응답:', res.data);
      if (res.data.status?.toLowerCase() === 'success') {
        // 서버 저장이 확인됐을 때만 로컬 보조 캐시를 남긴다 — 다음 실행에서 설문 조회가
        // 네트워크 오류로 실패해도 이 캐시가 있으면 설문 화면으로 되돌아가지 않는다.
        // (서버 데이터의 대체가 아니라 재온보딩 방지용 캐시일 뿐이다.)
        await surveyCompletedStorage.markCompleted();
        onDone();
      } else {
        console.warn('[SurveyScreen] 예상치 못한 응답:', res.data);
        onDone();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[SurveyScreen] POST 실패:', e);
      if (msg.includes('invalid_token') || msg.includes('401')) {
        setErrorMsg('인증 토큰이 유효하지 않습니다. 다시 로그인해주세요.');
      } else {
        setErrorMsg(`오류가 발생했습니다: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>어떤 산책을{'\n'}좋아하세요?</Text>
          <Text style={styles.pageIndicator}>1/1</Text>
        </View>

        <View style={styles.tagGrid}>
          {SURVEY_TAGS.map(option => {
            const selected = selectedTags.has(option.tagValue);
            return (
              <Pressable
                key={option.id}
                onPress={() => toggleTag(option.tagValue)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={2}>
                  {selected ? `✓ ${option.label}` : option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>선호 거리</Text>
        <DistanceSelector value={distance} onChange={setDistance} style={styles.distanceSelector} />

        <ErrorBanner message={errorMsg} />
      </ScrollView>

      <View style={styles.footer}>
        <Button label="완료" onPress={handleComplete} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 36,
  },
  pageIndicator: {
    color: colors.inkMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
    marginBottom: spacing.xxl,
  },
  chip: {
    width: CHIP_W,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextSelected: {
    color: colors.card,
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  distanceSelector: {
    marginBottom: spacing.xxl,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.card,
  },
});
