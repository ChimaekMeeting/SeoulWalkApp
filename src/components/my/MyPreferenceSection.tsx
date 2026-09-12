import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { MyPageSection, MyPageSubHeading } from './MyPageSection';
import { MyPreferenceItem } from './MyPreferenceItem';
import { DistanceSelector } from '../DistanceSelector';
import { Spinner } from '../Spinner';
import { SURVEY_TAGS, targetKmToDistanceOption } from '../../config/surveyOptions';
import { getSurvey, postSurvey } from '../../api/survey';
import { DistanceOption, SurveyStatusResponse } from '../../types/survey';
import { useCachedResource } from '../../hooks/useCachedResource';

// 이 화면엔 리소스가 하나뿐이라 고정 키. 로그아웃 시 useKakaoAuth가 cachedResource.clearAll()을
// 부르므로 이 캐시도 함께 지워진다(다음 로그인 유저에게 이전 유저 취향이 잠깐 보이지 않게).
const CACHE_KEY = 'myPreferenceSection:survey';

// 백엔드가 간헐적으로 "저장된 설문이 없다"(survey_completed=false·태그 없음·거리 없음)고 잘못
// 응답하는 문제가 있다(같은 유저인데 다음 호출엔 정상값). 캐시된 정상값이 없을 때는 이 횟수만큼
// 재시도한 뒤에야 빈 화면을 보여준다(정말 설문 안 한 유저일 수도 있어서) — 그 뒤로도 폴링은 계속한다.
const MAX_EMPTY_RETRIES = 3;

/** 화면에 그대로 쓰는 형태의 취향(태그 선택맵 + 거리). */
interface Prefs {
  tags: Record<string, boolean>;
  distance: DistanceOption | null;
}

const EMPTY_PREFS: Prefs = { tags: {}, distance: null };

/**
 * useCachedResource가 다루는 값. prefs만 담으면 "정말 빈 설문(신규 유저)"과 "백엔드가 간헐적으로
 * 잘못 준 빈 응답"을 구분할 신호(looksEmpty)가 사라지므로 함께 들고 있는다.
 */
interface SurveyFetch {
  prefs: Prefs;
  looksEmpty: boolean;
}

function tagsFromList(list: string[] | null | undefined): Record<string, boolean> {
  return Object.fromEntries((list ?? []).map(t => [t, true]));
}

/** 백엔드가 "저장된 설문 없음"으로 응답했는지(간헐적 오류 판별용). */
function isEmptySurvey(d: SurveyStatusResponse): boolean {
  return (
    !d.survey_completed &&
    (d.selected_tags?.length ?? 0) === 0 &&
    d.default_target_km == null
  );
}

function prefsFromResponse(d: SurveyStatusResponse): Prefs {
  return {
    tags: tagsFromList(d.selected_tags),
    distance: targetKmToDistanceOption(d.default_target_km),
  };
}

/**
 * 마이페이지의 '내 산책 취향' 섹션 — 태그(편안·안전·자연)와 선호 거리를 바꾸면 즉시 서버에
 * 저장한다. 설문 화면(SurveyScreen)과 같은 /api/user/survey 를 쓴다. 태그와 거리 중 하나만
 * 바뀌어도 둘 다 함께 POST 한다(한쪽만 보내 서버에서 다른 쪽이 지워지는 걸 막는다).
 *
 * 로딩은 useCachedResource에 맡긴다 — RouteHistoryList와 같은 훅이라 세션 캐시(탭 재방문 시
 * 즉시 복원), 재시도 사다리, 스피너 지연 규칙이 동일하다. "빈 설문 응답이 반복되면 결국
 * 드러낸다"는 이 화면만의 규칙은 isComplete/revealIncompleteAfter로 표현한다.
 */
export function MyPreferenceSection() {
  const { data, loading, showSpinner, mutate } = useCachedResource<SurveyFetch>({
    key: CACHE_KEY,
    fetcher: async () => {
      const { data: survey } = await getSurvey();
      console.log('[MyPreferenceSection] GET /api/user/survey 응답:', survey);
      return { prefs: prefsFromResponse(survey), looksEmpty: isEmptySurvey(survey) };
    },
    isComplete: result => !result.looksEmpty,
    revealIncompleteAfter: MAX_EMPTY_RETRIES,
    logLabel: '[MyPreferenceSection]',
  });

  const prefs = data?.prefs ?? EMPTY_PREFS;

  const save = (payloadTags: Record<string, boolean>, payloadDistance: DistanceOption | null) => {
    const payload = {
      tags: SURVEY_TAGS.filter(t => payloadTags[t.tagValue]).map(t => t.tagValue),
      distance: payloadDistance,
    };
    console.log('[MyPreferenceSection] POST /api/user/survey 요청:', payload);
    postSurvey(payload)
      .then(({ data: saved }) => {
        console.log('[MyPreferenceSection] POST /api/user/survey 응답:', saved);
      })
      .catch(e => {
        console.warn('[MyPreferenceSection] POST /api/user/survey 실패:', e?.message ?? e);
        // 저장 실패 → 화면과 캐시를 이전 값(이 호출이 만들어질 때의 prefs)으로 되돌린다.
        mutate({ prefs, looksEmpty: false });
      });
  };

  const toggleTag = (tagValue: string) => {
    const nextTags = { ...prefs.tags, [tagValue]: !prefs.tags[tagValue] };
    // 화면·캐시를 낙관적으로 먼저 바꾼다 — 탭을 나갔다 바로 들어와도 옛 선택이 보이지 않게.
    mutate({ prefs: { tags: nextTags, distance: prefs.distance }, looksEmpty: false });
    save(nextTags, prefs.distance);
  };

  const selectDistance = (value: DistanceOption) => {
    mutate({ prefs: { tags: prefs.tags, distance: value }, looksEmpty: false });
    save(prefs.tags, value);
  };

  return (
    <MyPageSection title="내 산책 취향">
      {showSpinner ? (
        <View style={styles.loadingRow}>
          <Spinner size={15} thickness={2} color={colors.inkMuted} />
          <Text style={styles.loadingText}>취향을 불러오는 중…</Text>
        </View>
      ) : null}

      <View style={[styles.group, showSpinner && styles.dimmed]}>
        <View style={styles.row} pointerEvents={loading ? 'none' : 'auto'}>
          {SURVEY_TAGS.map(tag => (
            <MyPreferenceItem
              key={tag.id}
              label={tag.label}
              value={prefs.tags[tag.tagValue]}
              onPress={() => toggleTag(tag.tagValue)}
            />
          ))}
        </View>

        <MyPageSubHeading>선호 거리</MyPageSubHeading>
        <View pointerEvents={loading ? 'none' : 'auto'}>
          <DistanceSelector value={prefs.distance} onChange={selectDistance} />
        </View>
      </View>
    </MyPageSection>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
  dimmed: {
    opacity: 0.4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
