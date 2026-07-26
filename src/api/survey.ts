import { client } from './client';
import { SurveyRequest, SurveyResponse, SurveyStatusResponse } from '../types/survey';

export type { SurveyRequest, SurveyResponse, SurveyStatusResponse };

export const getSurvey = (options?: { timeout?: number }) =>
  client.get<SurveyStatusResponse>('/api/user/survey', options);

export const postSurvey = (payload: SurveyRequest) =>
  client.post<SurveyResponse>('/api/user/survey', payload);
