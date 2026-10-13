/** Authentication & User Profile Types (< 60 lines) */

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  target_band?: string;
  starting_band?: string;
  is_guest?: boolean;
  onboarding_completed?: number | boolean;
  hearts?: number;
  coins?: number;
  streak_days?: number;
  xp?: number;
  created_at?: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: UserProfile;
  is_guest?: boolean;
  error?: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  display_name?: string;
  target_band?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at?: string;
}

export interface UserStats {
  user_id: string;
  target_band: string;
  starting_band: string;
  streak_days: number;
  coins: number;
  hearts: number;
  trust_score: number;
  daily_goal: number;
  xp: number;
}
