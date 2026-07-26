import { client } from './client';

export interface SurveyStatusResponse {
  survey_completed: boolean;
  selected_tags?: string[] | null;
  weights?: Record<string, number>;
}

export interface PostSurveyPayload {
  tags: string[];
  distance: 'slow' | 'normal' | 'fast' | null;
}

export interface PostSurveyResponse {
  status: string;
  weights_nature: number | null;
  weights_slope: number | null;
  weights_safety: number | null;
  weights_running: number | null;
  weights_landmark: number | null;
  weights_child: number | null;
  default_target_km: number | null;
}

export const getSurvey = (options?: { timeout?: number }) =>
  client.get<SurveyStatusResponse>('/api/user/survey', options);

export const postSurvey = (payload: PostSurveyPayload) =>
  client.post<PostSurveyResponse>('/api/user/survey', payload);
