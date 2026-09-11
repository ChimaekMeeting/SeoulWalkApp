import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { MyPageSection, MyPageSubHeading } from './MyPageSection';
import { MyPreferenceItem } from './MyPreferenceItem';
import { DistanceSelector } from '../DistanceSelector';
import { Spinner } from '../Spinner';
import { SURVEY_TAGS, targetKmToDistanceOption } from '../../config/surveyOptions';
import { getSurvey, postSurvey } from '../../api/survey';
import { DistanceOption, SurveyStatusResponse } from '../../types/survey';

// GET 실패·빈 응답 시 재시도 간격 — 처음 몇 번은 짧게 늘려가다(콜드스타트 대응) 이후 STEADY 주기로.
// 마이페이지에 머무는 동안 서버가 뒤늦게 응답해도 반영되게 하되, 지속적으로 실패하는 백엔드를
// 계속 두드리지 않도록 MAX_ATTEMPTS(약 6분)에서 멈춘다. 탭을 나갔다 들어오면 다시 시작한다.
const RETRY_DELAYS_MS = [1500, 3000, 6000, 12000];
const STEADY_RETRY_INTERVAL_MS = 30000;
const MAX_ATTEMPTS = 15;

// 로딩이 이 시간을 넘겨야 스피너를 띄운다 — 대부분의 응답은 이보다 빨라 아무것도 안 뜨고(깜빡임
// 없음), 느릴 때만 "불러오는 중"이 보인다.
const SPINNER_DELAY_MS = 280;

// 백엔드가 간헐적으로 "저장된 설문이 없다"(survey_completed=false·태그 없음·거리 없음)고 잘못
// 응답하는 문제가 있다(같은 유저인데 다음 호출엔 정상값). 캐시된 정상값이 없을 때는 이 횟수만큼
// 기다린 뒤에야 빈 화면을 보여준다(정말 설문 안 한 유저일 수도 있어서) — 그 뒤로도 폴링은 계속한다.
const MAX_EMPTY_RETRIES = 3;

/** 화면에 그대로 쓰는 형태의 취향(태그 선택맵 + 거리). */
interface Prefs {
  tags: Record<string, boolean>;
  distance: DistanceOption | null;
}

// 앱 세션 동안 마지막으로 받은 정상(비어있지 않은) 취향. 마이 탭은 이탈 시 언마운트되므로
// (MainRouter) 재방문마다 GET을 다시 하는데, 그동안 화면이 빈 채 잠기는 걸 막으려고 여기 담아
// 두고 다음 마운트에서 즉시 복원한다. 화면에서 값을 바꾸면 함께 갱신한다.
let cachedPrefs: Prefs | null = null;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
 * 로딩 처리:
 *  - 캐시(cachedPrefs)가 있으면 즉시 그 값으로 채우고 상호작용을 연다 — 탭 재방문 시 잠김 창 없음.
 *  - 캐시가 없으면 GET이 올 때까지 태그·거리 탭을 막고(pointerEvents), SPINNER_DELAY_MS를 넘기면
 *    스피너를 띄운다.
 *  - GET이 빈 응답이면 백엔드 간헐 오류로 보고 재시도한다(캐시가 있으면 무한정 무시).
 */
export function MyPreferenceSection() {
  const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>(
    () => cachedPrefs?.tags ?? {},
  );
  const [distance, setDistance] = useState<DistanceOption | null>(
    () => cachedPrefs?.distance ?? null,
  );
  // GET 응답 전엔 빈 값이 저장되지 않도록 버튼 탭만 조용히 막는다. 캐시가 있으면 처음부터 열림.
  const [loading, setLoading] = useState(cachedPrefs == null);
  // 로딩이 SPINNER_DELAY_MS를 넘겼을 때만 true.
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hadCache = cachedPrefs != null;

    // 캐시가 없을 때만 스피너 타이머 — 있으면 화면이 이미 채워져 있으니 표시하지 않는다.
    const spinnerTimer = hadCache
      ? undefined
      : setTimeout(() => {
          if (!cancelled) setShowSpinner(true);
        }, SPINNER_DELAY_MS);

    const applyPrefs = (prefs: Prefs, cache: boolean) => {
      setSelectedTags(prefs.tags);
      setDistance(prefs.distance);
      if (cache) cachedPrefs = prefs;
      setLoading(false);
      setShowSpinner(false);
    };

    const fetchWithRetry = async () => {
      let emptyAccepted = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const nextDelay = RETRY_DELAYS_MS[attempt] ?? STEADY_RETRY_INTERVAL_MS;
        try {
          const { data } = await getSurvey();
          if (cancelled) return;
          console.log('[MyPreferenceSection] GET /api/user/survey 응답:', data);

          if (isEmptySurvey(data)) {
            // 서버가 "저장된 설문 없음"으로 응답. 캐시가 있으면 확실히 서버 측 오류이므로
            // 무시하고 캐시를 유지한 채 재시도한다. 캐시가 없으면 MAX_EMPTY_RETRIES까지 기다려
            // 본 뒤, 그래도 비어 있으면 빈 화면을 열어 준다(신규 유저일 수도) — 남은 시도 동안
            // 폴링은 계속하고, 뒤늦게 정상값이 오면 채운다.
            if (!hadCache && !emptyAccepted && attempt >= MAX_EMPTY_RETRIES) {
              emptyAccepted = true;
              applyPrefs({ tags: {}, distance: null }, false);
            } else {
              console.warn(
                `[MyPreferenceSection] 빈 설문 응답 (${attempt + 1}/${MAX_ATTEMPTS}) — 재시도`,
              );
            }
            await sleep(nextDelay);
            if (cancelled) return;
            continue;
          }

          applyPrefs(prefsFromResponse(data), true);
          return;
        } catch (e) {
          if (cancelled) return;
          console.warn(
            `[MyPreferenceSection] GET /api/user/survey 실패 (${attempt + 1}/${MAX_ATTEMPTS}) — 재시도 예정:`,
            (e as { message?: string })?.message ?? e,
          );
          await sleep(nextDelay);
          if (cancelled) return;
        }
      }
      // 시도 소진 — 아직 아무것도 못 받았으면 잠금을 풀어 준다(빈 화면). 탭을 다시 열면 재시도.
      if (!cancelled) {
        console.warn('[MyPreferenceSection] GET /api/user/survey — 재시도 한도 도달, 중단');
        applyPrefs(cachedPrefs ?? { tags: {}, distance: null }, false);
      }
    };

    fetchWithRetry();
    return () => {
      cancelled = true;
      if (spinnerTimer) clearTimeout(spinnerTimer);
    };
  }, []);

  const save = (payloadTags: Record<string, boolean>, payloadDistance: DistanceOption | null) => {
    const payload = {
      tags: SURVEY_TAGS.filter(t => payloadTags[t.tagValue]).map(t => t.tagValue),
      distance: payloadDistance,
    };
    console.log('[MyPreferenceSection] POST /api/user/survey 요청:', payload);
    postSurvey(payload)
      .then(({ data }) => {
        console.log('[MyPreferenceSection] POST /api/user/survey 응답:', data);
      })
      .catch(e => {
        console.warn('[MyPreferenceSection] POST /api/user/survey 실패:', e?.message ?? e);
        // 저장 실패 → 화면과 캐시를 이전 값으로 되돌린다.
        setSelectedTags(selectedTags);
        setDistance(distance);
        cachedPrefs = { tags: selectedTags, distance };
      });
  };

  const toggleTag = (tagValue: string) => {
    const next = { ...selectedTags, [tagValue]: !selectedTags[tagValue] };
    setSelectedTags(next);
    // 화면에서 바꾼 값을 캐시에도 즉시 반영 — 탭을 나갔다 바로 들어와도 옛 선택이 잠깐 보이지 않게.
    cachedPrefs = { tags: next, distance };
    save(next, distance);
  };

  const selectDistance = (value: DistanceOption) => {
    setDistance(value);
    cachedPrefs = { tags: selectedTags, distance: value };
    save(selectedTags, value);
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
              value={selectedTags[tag.tagValue]}
              onPress={() => toggleTag(tag.tagValue)}
            />
          ))}
        </View>

        <MyPageSubHeading>선호 거리</MyPageSubHeading>
        <View pointerEvents={loading ? 'none' : 'auto'}>
          <DistanceSelector value={distance} onChange={selectDistance} />
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
