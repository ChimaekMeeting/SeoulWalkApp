import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { MyPageSection, MyPageSubHeading } from './MyPageSection';
import { MyPreferenceItem } from './MyPreferenceItem';
import { DistanceSelector } from '../DistanceSelector';
import { SURVEY_TAGS, targetKmToDistanceOption } from '../../config/surveyOptions';
import { getSurvey, postSurvey } from '../../api/survey';
import { DistanceOption } from '../../types/survey';

// GET 실패 시 재시도 간격 — 처음 몇 번은 짧게 늘려가다가(콜드스타트 대응) 그 뒤로는 이 주기로
// "포기하지 않고" 계속 재시도한다. 마이페이지에 머물러 있는 동안 서버가 뒤늦게 응답해도(콜드스타트든,
// 로컬 개발 중 백엔드를 뒤늦게 켰든) 탭을 나갔다 들어오지 않고도 화면에 반영되게 하려는 것 —
// 컴포넌트가 언마운트(탭 이탈)될 때만 멈춘다.
const INITIAL_RETRY_DELAYS_MS = [3000, 6000, 9000];
const STEADY_RETRY_INTERVAL_MS = 10000;

/**
 * 마이페이지의 '내 산책 취향' 섹션 — 태그(편안·안전·자연)와 선호 거리를 바꾸면 즉시 서버에
 * 저장한다. 설문 화면(SurveyScreen)과 같은 /api/user/survey 를 쓴다. 태그와 거리 중 하나만
 * 바뀌어도 둘 다 함께 POST 한다(한쪽만 보내 서버에서 다른 쪽이 지워지는 걸 막는다).
 */
export function MyPreferenceSection() {
  const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>({});
  const [distance, setDistance] = useState<DistanceOption | null>(null);
  // GET 응답이 오기 전까지는 selectedTags/distance가 전부 빈 값이다. 흐리게 처리 등 눈에 보이는
  // 로딩 표시는 일부러 안 둔다 — 응답이 보통 아주 빨리 와서, 잠깐 흐려졌다 바로 원래대로 돌아오는
  // 깜빡임이 오히려 더 거슬린다는 피드백. 대신 그 빈 값이 그대로 저장(save)되는 걸 막기 위해
  // 응답 전까지 버튼 탭만 조용히 막아둔다(pointerEvents, 화면엔 아무 표시 없음).
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const applyResponse = (data: Awaited<ReturnType<typeof getSurvey>>['data']) => {
      console.log('[MyPreferenceSection] GET /api/user/survey 응답:', data);
      setSelectedTags(Object.fromEntries((data.selected_tags ?? []).map(t => [t, true])));
      setDistance(targetKmToDistanceOption(data.default_target_km));
    };

    // 실패해도 포기하지 않고 탭에 머무는 동안 계속 재시도한다(언마운트 시에만 멈춤) — 유한
    // 횟수만 재시도하고 포기하면, 그 재시도 시간(수십 초)보다 서버가 늦게 뜬 경우(로컬 개발 중
    // 백엔드를 늦게 켰다거나) 탭을 나갔다 들어오지 않는 한 영영 안 채워지는 문제가 있었다.
    const fetchWithRetry = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const { data } = await getSurvey();
          if (cancelled) return;
          applyResponse(data);
          setLoading(false);
          return;
        } catch (e) {
          if (cancelled) return;
          console.warn(
            `[MyPreferenceSection] GET /api/user/survey 실패 (${attempt + 1}번째) — 재시도 예정:`,
            (e as { message?: string })?.message ?? e,
          );
          const delay = INITIAL_RETRY_DELAYS_MS[attempt] ?? STEADY_RETRY_INTERVAL_MS;
          await new Promise<void>(resolve => setTimeout(resolve, delay));
          if (cancelled) return;
        }
      }
    };

    fetchWithRetry();
    return () => {
      cancelled = true;
    };
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
    <MyPageSection title="내 산책 취향">
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
    </MyPageSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
