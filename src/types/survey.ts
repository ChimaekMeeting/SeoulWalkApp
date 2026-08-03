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
  weights_nature: number | null;
  weights_slope: number | null;
  weights_running: number | null;
  weights_landmark: number | null;
  weights_child: number | null;
};

export interface SurveyStatusResponse {
  status?: SurveyStatus;
  survey_completed: boolean;
  default_target_km: number | null;
  weights_safety: number | null;
  weights_nature: number | null;
  weights_slope: number | null;
  weights_running: number | null;
  weights_landmark: number | null;
  weights_child: number | null;
  selected_tags: string[] | null;
};
