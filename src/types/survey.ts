export type DistanceOption = 'slow' | 'normal' | 'fast';

export type SurveyStatus =
  | 'success'
  | 'access_expired_token'
  | 'invalid_token'
  | 'user_not_found';

export interface SurveyRequest {
  tags: string[];
  distance?: DistanceOption | null;
};

export interface SurveyResponse {
  status: SurveyStatus;
  default_target_km: number | null;
  weights_safety: number | null;
  weights_comfort: number | null;
  selected_tags: string[] | null;
};

export interface SurveyStatusResponse {
  status?: SurveyStatus;
  survey_completed: boolean;
  default_target_km: number | null;
  weights_safety: number | null;
  weights_comfort: number | null;
  selected_tags: string[] | null;
};
