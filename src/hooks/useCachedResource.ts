import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 서버에서 값을 한 번 받아 화면에 뿌리는 read 전용 리소스 훅.
 *
 * 왜 필요한가: Cloud Run 백엔드가 유휴 상태에서 깨어나는 데(콜드스타트) 첫 요청이 8~20초 걸리고,
 * 간헐적으로 실패하거나 빈 응답을 준다. 화면마다 "재시도 사다리 + 세션 캐시 + 스피너 지연"을
 * 손으로 다시 구현하던 걸(MyPreferenceSection, RouteHistoryList) 여기로 모은다.
 *
 * 동작:
 *  - 캐시(같은 key로 이번 세션에 마지막으로 받은 값)가 있으면 즉시 그 값으로 렌더하고 잠금을 연다.
 *    네트워크는 뒤에서 조용히 갱신한다(stale-while-revalidate).
 *  - 캐시가 없으면 loading=true(호출부가 상호작용을 막는 용도), spinnerDelayMs를 넘기면 showSpinner.
 *  - 실패하거나 isComplete가 false면 retryDelaysMs 간격으로 재시도하고, 소진되면 steadyRetryMs 주기로
 *    maxAttempts까지 계속한다. 다 소진되면 error=true.
 *  - revealIncompleteAfter회 이후로도 "불완전"한 응답만 온다면(캐시 없음), 그 값이라도 드러내고
 *    (loading=false) 남은 시도 동안 폴링은 계속한다 — 백엔드가 빈 설문을 잘못 주는 케이스 대응.
 *
 * 세션 캐시만 한다(모듈 전역 Map). 탭 이탈로 컴포넌트가 언마운트돼도 살아남지만, 앱을 완전히
 * 종료하면 사라진다.
 */

const DEFAULT_RETRY_DELAYS_MS = [1500, 3000, 6000, 12000];
const DEFAULT_STEADY_RETRY_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 15;
const DEFAULT_SPINNER_DELAY_MS = 280;

// key -> 이번 세션에 마지막으로 받은 정상 값. 탭 이탈로 컴포넌트가 언마운트돼도 살아남아,
// 재방문 시 빈 화면 없이 즉시 복원된다.
const sessionCache = new Map<string, unknown>();

/** 캐시를 바깥에서 다루기 위한 헬퍼(로그아웃 시 비우기, 설문 완료 직후 심기 등). */
export const cachedResource = {
  get<T>(key: string): T | undefined {
    return sessionCache.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): void {
    sessionCache.set(key, value);
  },
  clear(key: string): void {
    sessionCache.delete(key);
  },
  clearAll(): void {
    sessionCache.clear();
  },
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface UseCachedResourceOptions<T> {
  /** 캐시·재요청 구분 키. 바뀌면 처음부터 다시 불러온다. */
  key: string;
  /** 값을 가져오는 함수. signal이 abort되면 즉시 중단해야 한다. */
  fetcher: (signal: AbortSignal) => Promise<T>;
  /** false를 반환하면 응답이 왔어도 "아직 불완전"으로 보고 재시도한다. 기본값: 항상 true. */
  isComplete?: (data: T) => boolean;
  /** 이 횟수 이후로도 불완전 응답만 오면(캐시 없음) 그 값이라도 드러낸다. 기본값: 절대 안 함. */
  revealIncompleteAfter?: number;
  /** false면 아무것도 하지 않는다(조건부 로딩). 기본값: true. */
  enabled?: boolean;
  spinnerDelayMs?: number;
  retryDelaysMs?: number[];
  steadyRetryMs?: number;
  maxAttempts?: number;
  /** 진단 로그 접두어(예: '[RouteHistoryList]'). 주면 시도·실패를 콘솔에 남긴다. */
  logLabel?: string;
}

export interface UseCachedResourceResult<T> {
  /** 화면에 그릴 값. 캐시 → 응답 순. 아직 없으면 undefined. */
  data: T | undefined;
  /** 보여줄 값이 아직 없고 포기하지도 않음 — 호출부가 버튼 등을 잠그는 데 쓴다. */
  loading: boolean;
  /** loading이 spinnerDelayMs를 넘겼을 때만 true. */
  showSpinner: boolean;
  /** 재시도를 다 쓰고도 쓸 값을 못 받음(불완전 노출도 아직 안 된 상태). */
  error: boolean;
  /** 값은 있는데 뒤에서 갱신/재시도 중. */
  validating: boolean;
  /** 처음부터 다시 불러온다. */
  refresh: () => void;
  /** 화면·캐시 값을 바깥에서 교체한다(낙관적 쓰기 뒤). */
  mutate: (data: T) => void;
}

export function useCachedResource<T>(
  options: UseCachedResourceOptions<T>,
): UseCachedResourceResult<T> {
  const {
    key,
    isComplete,
    revealIncompleteAfter = Infinity,
    enabled = true,
    spinnerDelayMs = DEFAULT_SPINNER_DELAY_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    steadyRetryMs = DEFAULT_STEADY_RETRY_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    logLabel,
  } = options;

  // fetcher/isComplete는 매 렌더 새 함수일 수 있어 ref로 고정 — effect 재실행 트리거는 key뿐.
  const fetcherRef = useRef(options.fetcher);
  fetcherRef.current = options.fetcher;
  const isCompleteRef = useRef(isComplete);
  isCompleteRef.current = isComplete;

  const cached = cachedResource.get<T>(key);
  const [data, setData] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState(cached === undefined);
  const [showSpinner, setShowSpinner] = useState(false);
  const [error, setError] = useState(false);
  const [validating, setValidating] = useState(false);
  // refresh()가 effect를 다시 돌리게 하는 카운터.
  const [nonce, setNonce] = useState(0);

  const warn = useCallback(
    (msg: string, extra?: unknown) => {
      if (logLabel) console.warn(`${logLabel} ${msg}`, extra ?? '');
    },
    [logLabel],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();

    const startCache = cachedResource.get<T>(key);
    // key가 바뀌었을 수 있으니 상태를 그 key의 캐시에 맞춰 리셋한다.
    setData(startCache);
    setLoading(startCache === undefined);
    setError(false);
    setValidating(true);

    const spinnerTimer =
      startCache === undefined
        ? setTimeout(() => {
            if (!cancelled) setShowSpinner(true);
          }, spinnerDelayMs)
        : undefined;

    const finishSpinner = () => {
      if (spinnerTimer) clearTimeout(spinnerTimer);
      setShowSpinner(false);
    };

    const run = async () => {
      let incompleteRevealed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const nextDelay = retryDelaysMs[attempt] ?? steadyRetryMs;
        try {
          const result = await fetcherRef.current(controller.signal);
          if (cancelled) return;

          if (isCompleteRef.current && !isCompleteRef.current(result)) {
            const revealNow =
              startCache === undefined && attempt >= revealIncompleteAfter;
            if (revealNow || incompleteRevealed) {
              // 한 번 드러낸 뒤엔 이후 불완전 응답도 최신값으로 계속 반영한다(폴링은 유지).
              incompleteRevealed = true;
              setData(result);
              setLoading(false);
              finishSpinner();
            } else {
              warn(`불완전 응답 (${attempt + 1}/${maxAttempts}) — 재시도`);
            }
            await sleep(nextDelay);
            if (cancelled) return;
            continue;
          }

          cachedResource.set(key, result);
          setData(result);
          setLoading(false);
          setError(false);
          setValidating(false);
          finishSpinner();
          return;
        } catch (e) {
          if (cancelled) return;
          warn(
            `요청 실패 (${attempt + 1}/${maxAttempts}) — 재시도 예정:`,
            (e as { message?: string })?.message ?? e,
          );
          await sleep(nextDelay);
          if (cancelled) return;
        }
      }

      // 시도 소진.
      if (cancelled) return;
      warn('재시도 한도 도달 — 중단');
      setValidating(false);
      finishSpinner();
      setLoading(false);
      // 캐시도 불완전 노출도 없었으면 에러로 표시.
      setError(cachedResource.get<T>(key) === undefined && !incompleteRevealed);
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
      if (spinnerTimer) clearTimeout(spinnerTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const mutate = useCallback(
    (next: T) => {
      cachedResource.set(key, next);
      setData(next);
      setLoading(false);
      setError(false);
    },
    [key],
  );

  return { data, loading, showSpinner, error, validating, refresh, mutate };
}
