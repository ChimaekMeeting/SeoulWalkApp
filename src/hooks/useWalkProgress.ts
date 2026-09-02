import { useEffect, useMemo, useRef, useState } from 'react';
import { Coordinates } from '../types/location';
import { WalkRouteResponse } from '../types/prewalk';
import { WalkProgress, WalkProgressTracker, deriveProgress } from '../utils/walkProgress';

/** 개발 빌드에서만 채워진다(프로덕션에선 null). GPS 없이 진행률 상태를 강제해 화면을 확인하는 용도. */
export interface WalkProgressDevControls {
  /** 경로 진행률을 ratio(0~1)로 강제 */
  seek: (ratio: number) => void;
  /** 종착점 도착 완료로 강제 */
  complete: () => void;
  /** 경로 이탈 상태로 */
  offRoute: () => void;
  /** 강제한 상태는 그대로 두고, 실시간 GPS 반영만 다시 켠다(진행률은 안 되돌린다) */
  resume: () => void;
  /** 트래커를 완전히 초기화(진행률 0%) 후 실시간 GPS 반영 재개 */
  reset: () => void;
}

/**
 * 산책 중 GPS fix를 WalkProgressTracker에 흘려보내 진행률을 만드는 훅.
 *
 * tracker는 내부 상태를 들고 있어(순수하지 않음) 렌더 중에 update를 호출하면 StrictMode·concurrent
 * 재렌더에서 같은 fix가 중복 반영될 수 있다. 그래서 update는 useEffect에서만 호출하고, 동일 fix
 * (timestamp+좌표)가 다시 들어오면 건너뛴다. 훅 인스턴스 하나 = 산책 한 번(화면 마운트~종료).
 *
 * coords는 호출부(WalkInProgressScreen)가 useWatchLocation으로 이미 구독한 값을 넘긴다 —
 * 위치 구독이 두 개로 늘어나지 않게.
 *
 * 개발 빌드에선 dev 컨트롤이 함께 반환된다. 하나라도 누르면 실시간 GPS 반영이 멈추고(dev.reset으로 재개),
 * 강제한 상태가 유지된다.
 */
export function useWalkProgress(
  coords: Coordinates | null,
  routeCoords: WalkRouteResponse['coordinates'],
  routeLengthKm: number,
): { progress: WalkProgress; dev: WalkProgressDevControls | null } {
  const trackerRef = useRef<WalkProgressTracker | undefined>(undefined);
  if (!trackerRef.current) trackerRef.current = new WalkProgressTracker();

  const [progress, setProgress] = useState<WalkProgress>(() =>
    deriveProgress(0, routeLengthKm),
  );
  const lastFixKeyRef = useRef<string | null>(null);
  const devEngagedRef = useRef(false);

  useEffect(() => {
    if (!coords || devEngagedRef.current) return;
    const nowMs = coords.timestamp ?? Date.now();
    const fixKey = `${nowMs}:${coords.latitude},${coords.longitude}`;
    if (fixKey === lastFixKeyRef.current) return;
    lastFixKeyRef.current = fixKey;

    setProgress(
      trackerRef.current!.update(
        [coords.latitude, coords.longitude],
        routeCoords,
        routeLengthKm,
        nowMs,
        coords.accuracy ?? undefined,
      ),
    );
  }, [coords, routeCoords, routeLengthKm]);

  const dev = useMemo<WalkProgressDevControls | null>(() => {
    if (!__DEV__) return null;
    const t = trackerRef.current!;
    return {
      seek: ratio => {
        devEngagedRef.current = true;
        setProgress(t.devSeek(ratio * routeLengthKm, routeLengthKm));
      },
      complete: () => {
        devEngagedRef.current = true;
        setProgress(t.devComplete(routeLengthKm));
      },
      offRoute: () => {
        devEngagedRef.current = true;
        setProgress(t.devOffRoute(routeLengthKm));
      },
      resume: () => {
        devEngagedRef.current = false;
        lastFixKeyRef.current = null;
      },
      reset: () => {
        devEngagedRef.current = false;
        lastFixKeyRef.current = null;
        setProgress(t.devReset(routeLengthKm));
      },
    };
  }, [routeLengthKm]);

  return { progress, dev };
}
