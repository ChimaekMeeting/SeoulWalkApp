/**
 * useWalkProgress: tracker(상태를 들고 있는 클래스)를 렌더가 아니라 useEffect에서만 돌리는지,
 * 같은 GPS fix가 재렌더로 중복 반영되지 않는지 검증. 훅을 얇은 Probe로 감싸 관찰한다.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useWalkProgress } from '../useWalkProgress';
import { WalkProgress, WalkProgressTracker } from '../../utils/walkProgress';
import { polylineLengthKm } from '../../utils/geo';
import { Coordinates } from '../../types/location';
import { WalkRouteResponse } from '../../types/prewalk';

const ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5, 127.0],
  [37.501, 127.0],
  [37.502, 127.0],
  [37.503, 127.0],
];
const LEN = polylineLengthKm(ROUTE);

const fix = (lat: number, lon: number, ts: number): Coordinates => ({
  latitude: lat,
  longitude: lon,
  timestamp: ts,
  accuracy: 5,
});

let updateSpy: jest.SpyInstance;
beforeEach(() => {
  updateSpy = jest.spyOn(WalkProgressTracker.prototype, 'update');
});
afterEach(() => updateSpy.mockRestore());

type HookResult = ReturnType<typeof useWalkProgress>;

function renderProbe(initial: Coordinates | null, strict = false) {
  const box: { current: HookResult } = { current: null as never };
  function Probe({ coords }: { coords: Coordinates | null }) {
    box.current = useWalkProgress(coords, ROUTE, LEN);
    return null;
  }
  const tree = (coords: Coordinates | null) =>
    strict ? (
      <React.StrictMode>
        <Probe coords={coords} />
      </React.StrictMode>
    ) : (
      <Probe coords={coords} />
    );
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(tree(initial));
  });
  return {
    box,
    rerender: (coords: Coordinates | null) =>
      ReactTestRenderer.act(() => renderer.update(tree(coords))),
    unmount: () => ReactTestRenderer.act(() => renderer.unmount()),
  };
}

it('coords가 안 바뀌면 재렌더해도 tracker.update를 다시 호출하지 않는다', () => {
  const a = fix(37.5, 127.0, 1000);
  const { rerender, unmount } = renderProbe(a);
  expect(updateSpy).toHaveBeenCalledTimes(1);
  rerender(a);
  rerender(a);
  expect(updateSpy).toHaveBeenCalledTimes(1);
  unmount();
});

it('동일 fix(같은 timestamp+좌표)의 새 객체는 건너뛰고, 다른 fix는 처리한다', () => {
  const { box, rerender, unmount } = renderProbe(fix(37.5, 127.0, 1000));
  expect(updateSpy).toHaveBeenCalledTimes(1);

  // 값이 같은 새 객체 → fixKey 동일 → 건너뜀.
  rerender({ ...fix(37.5, 127.0, 1000) });
  expect(updateSpy).toHaveBeenCalledTimes(1);

  // 실제로 이동한 다음 fix(60초 뒤 ~56m) → 처리.
  rerender(fix(37.5005, 127.0, 61_000));
  expect(updateSpy).toHaveBeenCalledTimes(2);
  expect(box.current.progress.routeProgressKm).toBeGreaterThan(0);
  unmount();
});

it('StrictMode 이중 마운트에서도 진행률이 두 배로 늘지 않는다', () => {
  const seq = [
    fix(37.5, 127.0, 1_000),
    fix(37.5005, 127.0, 61_000),
    fix(37.501, 127.0, 121_000),
  ];
  const strict = renderProbe(seq[0], true);
  strict.rerender(seq[1]);
  strict.rerender(seq[2]);
  const strictProgress = strict.box.current.progress;
  strict.unmount();

  // 같은 fix 시퀀스를 tracker에 직접 한 번씩만 흘려보낸 기준값.
  const ref = new WalkProgressTracker();
  let refProgress!: WalkProgress;
  for (const c of seq) {
    refProgress = ref.update([c.latitude, c.longitude], ROUTE, LEN, c.timestamp!, c.accuracy!);
  }

  expect(strictProgress.routeProgressKm).toBeCloseTo(refProgress.routeProgressKm, 6);
  expect(strictProgress.actualDistanceKm).toBeCloseTo(refProgress.actualDistanceKm, 6);
});

it('coords가 null이면 update를 호출하지 않고 초기 진행률을 반환한다', () => {
  const { box, unmount } = renderProbe(null);
  expect(updateSpy).not.toHaveBeenCalled();
  expect(box.current.progress.routeProgressRatio).toBe(0);
  expect(box.current.progress.state).toBe('initializing');
  unmount();
});

it('dev 컨트롤: seek/complete로 상태를 강제하고, 그 뒤 실시간 GPS는 무시된다', () => {
  const { box, rerender, unmount } = renderProbe(fix(37.5, 127.0, 1_000));
  const dev = box.current.dev;
  expect(dev).not.toBeNull();

  ReactTestRenderer.act(() => dev!.seek(0.5));
  expect(box.current.progress.routeProgressRatio).toBeCloseTo(0.5, 5);

  // dev 관여 후엔 실시간 GPS fix가 들어와도 진행률이 안 바뀐다.
  rerender(fix(37.5005, 127.0, 61_000));
  expect(box.current.progress.routeProgressRatio).toBeCloseTo(0.5, 5);

  ReactTestRenderer.act(() => dev!.complete());
  expect(box.current.progress.state).toBe('complete');
  expect(box.current.progress.routeProgressRatio).toBe(1);

  ReactTestRenderer.act(() => dev!.reset());
  expect(box.current.progress.state).toBe('initializing');
  expect(box.current.progress.routeProgressRatio).toBe(0);
  unmount();
});
