import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { postSurvey } from '../api/survey';
import { surveyQuestions } from '../config/surveyQuestions';
import { radii, spacing } from '../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');
const CHIP_GAP = spacing.sm;
const CHIP_W = (SCREEN_W - spacing.xxl * 2 - CHIP_GAP * 2) / 3;

type Distance = 'slow' | 'normal' | 'fast';

const DISTANCE_OPTIONS: { value: Distance; label: string; sub: string }[] = [
  { value: 'slow',   label: '~2km',   sub: '가볍게' },
  { value: 'normal', label: '2~4km',  sub: '적당히' },
  { value: 'fast',   label: '4km+',   sub: '활발하게' },
];

const ALL_OPTIONS = surveyQuestions.flatMap(q => q.options);

interface Props {
  onDone: () => void;
}

export function SurveyScreen({ onDone }: Props) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [distance, setDistance] = useState<Distance | null>(null);
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
    try {
      const res = await postSurvey({ tags: Array.from(selectedTags), distance });
      console.log('[SurveyScreen] POST /api/user/survey 응답:', res.data);
      if (res.data.status?.toLowerCase() === 'success') {
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
          {ALL_OPTIONS.map(option => {
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
        <View style={styles.distanceRow}>
          {DISTANCE_OPTIONS.map(opt => {
            const selected = distance === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setDistance(opt.value)}
                style={[styles.distanceBtn, selected && styles.distanceBtnSelected]}
              >
                <Text style={[styles.distanceLabel, selected && styles.distanceLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={[styles.distanceSub, selected && styles.distanceSubSelected]}>
                  {opt.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleComplete}
          disabled={loading}
          style={({ pressed }) => [styles.completeBtn, (pressed || loading) && styles.pressed]}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.completeBtnText}>완료</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#111',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 36,
  },
  pageIndicator: {
    color: '#9E9E9E',
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
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  chipText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextSelected: {
    color: '#fff',
  },
  sectionLabel: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  distanceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  distanceBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  distanceBtnSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  distanceLabel: {
    color: '#111',
    fontSize: 15,
    fontWeight: '800',
  },
  distanceLabelSelected: {
    color: '#fff',
  },
  distanceSub: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  distanceSubSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  errorBox: {
    borderRadius: radii.md,
    backgroundColor: '#fde8e8',
    borderWidth: 1,
    borderColor: '#f5c6c6',
    padding: spacing.md,
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: '#fff',
  },
  completeBtn: {
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.75,
  },
});
