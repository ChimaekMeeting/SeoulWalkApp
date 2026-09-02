jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { getRecentRouteUsage, markRouteWalked } from '../recentRouteUsage';

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getRecentRouteUsage', () => {
  it('저장된 JSON 맵을 파싱해 돌려준다', async () => {
    getItemAsync.mockResolvedValueOnce('{"12":1756800000000}');
    await expect(getRecentRouteUsage()).resolves.toEqual({ '12': 1756800000000 });
  });

  it('값이 없거나 조회가 실패하면 빈 객체', async () => {
    getItemAsync.mockResolvedValueOnce(null);
    await expect(getRecentRouteUsage()).resolves.toEqual({});

    getItemAsync.mockRejectedValueOnce(new Error('store unavailable'));
    await expect(getRecentRouteUsage()).resolves.toEqual({});
  });
});

describe('markRouteWalked', () => {
  it('기존 맵에 route id → 시각을 추가해 저장한다', async () => {
    getItemAsync.mockResolvedValueOnce('{"12":1000}');
    setItemAsync.mockResolvedValueOnce(undefined);

    await markRouteWalked(34, 2000);

    expect(setItemAsync).toHaveBeenCalledWith(
      'recent_route_usage_v1',
      JSON.stringify({ '12': 1000, '34': 2000 }),
    );
  });

  it('40개를 넘으면 최근 항목만 남긴다', async () => {
    const existing: Record<string, number> = {};
    for (let i = 0; i < 45; i++) existing[String(i)] = i;
    getItemAsync.mockResolvedValueOnce(JSON.stringify(existing));
    setItemAsync.mockResolvedValueOnce(undefined);

    await markRouteWalked(999, 1_000_000);

    const saved = JSON.parse(setItemAsync.mock.calls[0][1]);
    expect(Object.keys(saved)).toHaveLength(40);
    expect(saved['999']).toBe(1_000_000);
    // 가장 오래된(작은 값) 항목들은 잘려나간다.
    expect(saved['0']).toBeUndefined();
  });

  it('저장이 실패해도 throw하지 않는다', async () => {
    getItemAsync.mockResolvedValueOnce(null);
    setItemAsync.mockRejectedValueOnce(new Error('keychain error'));

    await expect(markRouteWalked(1, 1)).resolves.toBeUndefined();
  });
});
