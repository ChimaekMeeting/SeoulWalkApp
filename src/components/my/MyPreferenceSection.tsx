import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { MyPreferenceItem } from './MyPreferenceItem';
import { DistanceSelector } from '../DistanceSelector';
import { SURVEY_TAGS, targetKmToDistanceOption } from '../../config/surveyOptions';
import { getSurvey, postSurvey } from '../../api/survey';
import { DistanceOption } from '../../types/survey';

/**
 * 마이페이지의 '내 산책 취향' 섹션 — 태그(편안·안전·자연)와 선호 거리를 바꾸면 즉시 서버에
 * 저장한다. 설문 화면(SurveyScreen)과 같은 /api/user/survey 를 쓴다. 태그와 거리 중 하나만
 * 바뀌어도 둘 다 함께 POST 한다(한쪽만 보내 서버에서 다른 쪽이 지워지는 걸 막는다).
 */
export function MyPreferenceSection() {
  const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>({});
  const [distance, setDistance] = useState<DistanceOption | null>(null);

  useEffect(() => {
    getSurvey()
      .then(({ data }) => {
        console.log('[MyPreferenceSection] GET /api/user/survey 응답:', data);
        setSelectedTags(Object.fromEntries((data.selected_tags ?? []).map(t => [t, true])));
        setDistance(targetKmToDistanceOption(data.default_target_km));
      })
      .catch(e => {
        console.warn('[MyPreferenceSection] GET /api/user/survey 실패:', e?.message ?? e);
        // 실패 시 초기값 유지 — 전부 기본 스타일
      });
  }, []);

  const save = (
    nextTags: Record<string, boolean>,
    nextDistance: DistanceOption | null,
    rollback: () => void,
  ) => {
    const payload = {
      tags: SURVEY_TAGS.filter(t => nextTags[t.tagValue]).map(t => t.tagValue),
      distance: nextDistance,
    };
    console.log('[MyPreferenceSection] POST /api/user/survey 요청:', payload);
    postSurvey(payload)
      .then(({ data }) => {
        console.log('[MyPreferenceSection] POST /api/user/survey 응답:', data);
      })
      .catch(e => {
        console.warn('[MyPreferenceSection] POST /api/user/survey 실패:', e?.message ?? e);
        rollback(); // 저장 실패 시 이전 상태로 되돌림
      });
  };

  const toggleTag = (tagValue: string) => {
    const prev = selectedTags;
    const next = { ...prev, [tagValue]: !prev[tagValue] };
    setSelectedTags(next);
    save(next, distance, () => setSelectedTags(prev));
  };

  const selectDistance = (value: DistanceOption) => {
    const prev = distance;
    setDistance(value);
    save(selectedTags, value, () => setDistance(prev));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>내 산책 취향</Text>
      <View style={styles.row}>
        {SURVEY_TAGS.map(tag => (
          <MyPreferenceItem
            key={tag.id}
            label={tag.label}
            value={selectedTags[tag.tagValue]}
            onPress={() => toggleTag(tag.tagValue)}
          />
        ))}
      </View>

      <Text style={styles.subHeading}>선호 거리</Text>
      <DistanceSelector value={distance} onChange={selectDistance} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.containerBackground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  heading: {
    fontWeight: '900',
    fontSize: 16,
    color: colors.ink,
  },
  subHeading: {
    fontWeight: '800',
    fontSize: 14,
    color: colors.ink,
  },
});
