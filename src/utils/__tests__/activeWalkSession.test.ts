/**
 * activeWalkSession: AsyncStorage 왕복 직렬화, 손상된 JSON/스키마 방어, update의 부분 갱신,
 * clear 후 "세션 없음" 판정을 검증. 공식 jest 목(async-storage-mock)으로 실제 저장소처럼 동작시킨다.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeWalkSession } from '../activeWalkSession';
import { WalkRouteResponse } from '../../types/prewalk';

const ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5, 127.0],
  [37.501, 127.0],
];

afterEach(async () => {
  await AsyncStorage.clear();
});

describe('activeWalkSession', () => {
  it('세션이 없으면 read가 ok:true, session:null을 돌려준다', async () => {
    const result = await activeWalkSession.read();
    expect(result).toEqual({ ok: true, session: null });
  });

  it('write한 세션을 read로 그대로 돌려받는다', async () => {
    await activeWalkSession.write({
      route: ROUTE,
      maneuvers: null,
      lastAnnouncedAtKm: null,
      startedAt: 1000,
    });
    const result = await activeWalkSession.read();
    expect(result).toEqual({
      ok: true,
      session: {
        route: ROUTE,
        maneuvers: null,
        lastAnnouncedAtKm: null,
        startedAt: 1000,
      },
    });
  });

  it('update는 세션이 있을 때만 지정한 필드만 바꾼다', async () => {
    await activeWalkSession.write({
      route: ROUTE,
      maneuvers: null,
      lastAnnouncedAtKm: null,
      startedAt: 1000,
    });
    await activeWalkSession.update({ lastAnnouncedAtKm: 0.5 });
    const result = await activeWalkSession.read();
    expect(result.ok && result.session?.lastAnnouncedAtKm).toBe(0.5);
    expect(result.ok && result.session?.route).toEqual(ROUTE); // route는 그대로

    // 세션이 없는 상태에서 update를 불러도 조용히 아무 일도 안 한다(새로 만들지 않음).
    await activeWalkSession.clear();
    await activeWalkSession.update({ lastAnnouncedAtKm: 1 });
    expect(await activeWalkSession.read()).toEqual({ ok: true, session: null });
  });

  it('clear 후에는 read가 세션 없음을 돌려준다', async () => {
    await activeWalkSession.write({
      route: ROUTE,
      maneuvers: null,
      lastAnnouncedAtKm: null,
      startedAt: 1000,
    });
    await activeWalkSession.clear();
    expect(await activeWalkSession.read()).toEqual({ ok: true, session: null });
  });

  it('파싱 자체가 안 되는 JSON은 조회 실패(ok:false)로 구분한다', async () => {
    await AsyncStorage.setItem('active_walk_session_v1', '{not valid json');
    const result = await activeWalkSession.read();
    expect(result.ok).toBe(false);
  });

  it('파싱은 되지만 route가 없는 예전/손상된 스키마는 세션 없음으로 취급한다', async () => {
    await AsyncStorage.setItem(
      'active_walk_session_v1',
      JSON.stringify({ foo: 'bar' }),
    );
    expect(await activeWalkSession.read()).toEqual({ ok: true, session: null });
  });

  it('maneuvers 필드가 생기기 전에 저장된 세션(route/startedAt만 있음)은 maneuvers를 null로 채운다', async () => {
    await AsyncStorage.setItem(
      'active_walk_session_v1',
      JSON.stringify({
        route: ROUTE,
        lastAnnouncedAtKm: null,
        startedAt: 1000,
      }),
    );
    const result = await activeWalkSession.read();
    expect(result.ok && result.session?.maneuvers).toBeNull();
  });
});
