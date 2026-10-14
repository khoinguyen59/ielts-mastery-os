export interface UserStats {
  user_id: string;
  total_words_reviewed: number;
  streak_days: number;
  retention_rate: number;
  current_band: number;
  target_band: number;
  current_course: string;
  current_unit_index: number;
  current_node_index: number;
  hearts: number;
  coins: number;
  trust_score: number;
  onboarding_completed: number;
  last_review_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProgressionUpdate {
  user_id: string;
  course_id?: string;
  unit_index?: number;
  node_index?: number;
  hearts_delta?: number;
  coins_delta?: number;
  trust_delta?: number;
}

export interface UserHeartRechargeResult {
  hearts: number;
  coins: number;
  message: string;
  success: boolean;
}
