jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { onboardingStorage, surveyCompletedStorage } from '../onboardingStorage';

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;
const deleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('onboardingStorage.markSeen — 저장 후 재확인', () => {
  it('setItemAsync 성공 + 재조회값이 "true"면 true (시나리오 B)', async () => {
    setItemAsync.mockResolvedValueOnce(undefined);
    getItemAsync.mockResolvedValueOnce('true');

    await expect(onboardingStorage.markSeen()).resolves.toBe(true);
    expect(setItemAsync).toHaveBeenCalledWith('has_seen_onboarding', 'true');
  });

  it('setItemAsync는 resolve됐지만 재조회값이 없으면 false (시나리오 F — 검증 실패)', async () => {
    setItemAsync.mockResolvedValueOnce(undefined);
    getItemAsync.mockResolvedValueOnce(null);

    await expect(onboardingStorage.markSeen()).resolves.toBe(false);
  });

  it('setItemAsync가 throw하면 false (시나리오 E — 저장 실패)', async () => {
    setItemAsync.mockRejectedValueOnce(new Error('keychain error'));

    await expect(onboardingStorage.markSeen()).resolves.toBe(false);
  });
});

describe('onboardingStorage.readHasSeen — 조회 실패와 값 없음 구분', () => {
  it('값이 "true"면 { ok: true, value: true } (시나리오 C/D)', async () => {
    getItemAsync.mockResolvedValueOnce('true');

    await expect(onboardingStorage.readHasSeen()).resolves.toEqual({
      ok: true,
      value: true,
      raw: 'true',
    });
  });

  it('값이 없으면 { ok: true, value: false } — 신규 사용자 (시나리오 A)', async () => {
    getItemAsync.mockResolvedValueOnce(null);

    await expect(onboardingStorage.readHasSeen()).resolves.toEqual({
      ok: true,
      value: false,
      raw: null,
    });
  });

  it('값이 "true"가 아니면 { ok: true, value: false } (시나리오 H)', async () => {
    getItemAsync.mockResolvedValueOnce('1');

    await expect(onboardingStorage.readHasSeen()).resolves.toEqual({
      ok: true,
      value: false,
      raw: '1',
    });
  });

  it('조회가 throw하면 { ok: false } — "값 없음"과 구분 (시나리오 G)', async () => {
    const error = new Error('store unavailable');
    getItemAsync.mockRejectedValueOnce(error);

    await expect(onboardingStorage.readHasSeen()).resolves.toEqual({
      ok: false,
      error,
    });
  });
});

describe('surveyCompletedStorage — 설문 완료 보조 캐시', () => {
  it('markCompleted: 저장 후 재조회값이 "true"면 true', async () => {
    setItemAsync.mockResolvedValueOnce(undefined);
    getItemAsync.mockResolvedValueOnce('true');

    await expect(surveyCompletedStorage.markCompleted()).resolves.toBe(true);
    expect(setItemAsync).toHaveBeenCalledWith('survey_completed_v1', 'true');
  });

  it('get: 값이 "true"면 true, 없으면 false, 조회 실패도 false', async () => {
    getItemAsync.mockResolvedValueOnce('true');
    await expect(surveyCompletedStorage.get()).resolves.toBe(true);

    getItemAsync.mockResolvedValueOnce(null);
    await expect(surveyCompletedStorage.get()).resolves.toBe(false);

    getItemAsync.mockRejectedValueOnce(new Error('store unavailable'));
    await expect(surveyCompletedStorage.get()).resolves.toBe(false);
  });

  it('clear: deleteItemAsync를 호출하고, 실패해도 throw하지 않는다', async () => {
    deleteItemAsync.mockResolvedValueOnce(undefined);
    await expect(surveyCompletedStorage.clear()).resolves.toBeUndefined();
    expect(deleteItemAsync).toHaveBeenCalledWith('survey_completed_v1');

    deleteItemAsync.mockRejectedValueOnce(new Error('keychain error'));
    await expect(surveyCompletedStorage.clear()).resolves.toBeUndefined();
  });
});
