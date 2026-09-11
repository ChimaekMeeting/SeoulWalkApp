/**
 * useCachedResource: 재시도 사다리 · 세션 캐시(stale-while-revalidate) · 스피너 지연 ·
 * 불완전 응답 노출 규칙을 검증한다. 훅을 얇은 Probe로 감싸 관찰한다.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  useCachedResource,
  cachedResource,
  UseCachedResourceOptions,
  UseCachedResourceResult,
} from '../useCachedResource';

// 테스트에서 재시도 대기가 실제로 흐르지 않도록 아주 짧게.
const FAST = { spinnerDelayMs: 5, retryDelaysMs: [10, 10, 10], steadyRetryMs: 10 };

const flush = (ms: number) =>
  ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

function renderProbe<T>(options: UseCachedResourceOptions<T>) {
  const box: { current: UseCachedResourceResult<T> } = { current: null as never };
  function Probe() {
    box.current = useCachedResource(options);
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  // 동기 act로 마운트 — 첫 렌더 직후 상태(캐시 유무)를 관찰하기 위해. 이후 비동기 갱신은
  // 각 테스트가 flush()로 act 안에서 흘려보낸다.
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  return { box, unmount: () => ReactTestRenderer.act(() => renderer.unmount()) };
}

beforeEach(() => cachedResource.clearAll());

it('성공하면 data를 채우고 loading을 끝낸다', async () => {
  const { box, unmount } = renderProbe({
    key: 'k1',
    fetcher: async () => 'hello',
    ...FAST,
  });
  expect(box.current.loading).toBe(true);

  await flush(1);
  expect(box.current.data).toBe('hello');
  expect(box.current.loading).toBe(false);
  expect(box.current.error).toBe(false);
  unmount();
});

it('같은 key로 다시 마운트하면 캐시로 즉시 채우고 잠금을 열지 않는다', async () => {
  const first = renderProbe({ key: 'k2', fetcher: async () => 42, ...FAST });
  await flush(1);
  first.unmount();

  const fetcher = jest.fn(async () => 99);
  const second = renderProbe({ key: 'k2', fetcher, ...FAST });
  // 첫 렌더부터 캐시값이 보이고 loading=false.
  expect(second.box.current.data).toBe(42);
  expect(second.box.current.loading).toBe(false);

  // 네트워크는 뒤에서 돌아 최신값으로 갱신.
  await flush(1);
  expect(fetcher).toHaveBeenCalled();
  expect(second.box.current.data).toBe(99);
  second.unmount();
});

it('실패하면 재시도하고, 그 사이 loading을 유지한다', async () => {
  let calls = 0;
  const { box, unmount } = renderProbe({
    key: 'k3',
    fetcher: async () => {
      calls += 1;
      if (calls < 3) throw new Error('네트워크 오류');
      return 'ok';
    },
    ...FAST,
  });

  await flush(1);
  expect(box.current.loading).toBe(true); // 아직 재시도 중
  expect(box.current.data).toBeUndefined();

  await flush(40);
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(box.current.data).toBe('ok');
  expect(box.current.loading).toBe(false);
  unmount();
});

it('불완전 응답이 이어지면 revealIncompleteAfter 시점에 그 값을 드러내고 폴링은 계속한다', async () => {
  let calls = 0;
  const { box, unmount } = renderProbe<{ done: boolean; n: number }>({
    key: 'k4',
    fetcher: async () => {
      calls += 1;
      // 앞쪽 시도는 계속 불완전, 아주 나중에야 완전해진다.
      return { done: calls >= 30, n: calls };
    },
    isComplete: d => d.done,
    revealIncompleteAfter: 2,
    ...FAST,
  });

  // attempt 0,1은 숨기고 재시도 → attempt 2에서 불완전값이 드러난다.
  await flush(40);
  expect(box.current.loading).toBe(false);
  expect(box.current.data?.done).toBe(false);
  expect(box.current.error).toBe(false);

  // 드러난 뒤에도 폴링은 계속돼 n(시도 횟수)이 늘어난다.
  const revealedN = box.current.data!.n;
  await flush(40);
  expect(box.current.data!.n).toBeGreaterThan(revealedN);
  unmount();
});

it('재시도를 다 쓰고 캐시도 없으면 error를 세운다', async () => {
  const { box, unmount } = renderProbe({
    key: 'k5',
    fetcher: async () => {
      throw new Error('계속 실패');
    },
    maxAttempts: 3,
    ...FAST,
  });

  await flush(60);
  expect(box.current.error).toBe(true);
  expect(box.current.loading).toBe(false);
  expect(box.current.data).toBeUndefined();
  unmount();
});

it('mutate는 화면값과 캐시를 함께 교체한다', async () => {
  const { box, unmount } = renderProbe<string>({
    key: 'k6',
    fetcher: async () => 'server',
    ...FAST,
  });
  await flush(1);

  ReactTestRenderer.act(() => box.current.mutate('optimistic'));
  expect(box.current.data).toBe('optimistic');
  expect(cachedResource.get('k6')).toBe('optimistic');
  unmount();
});
