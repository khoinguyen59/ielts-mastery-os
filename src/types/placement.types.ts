import { z } from 'zod';

export type PresetLevel = 'starter' | 'foundation' | 'intermediate' | 'advanced' | 'mastery';

export interface LevelConfig {
  key?: PresetLevel;
  title: string;
  band: string;
  description: string;
  startingScore: number;
  starting_vocab_score: number;
  recommended_daily: number;
  fsrs_initial_stability: number;
  fsrs_target_retention: number;
}

export interface DiagnosticQuestion {
  id: string;
  target_band: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  focus_area: string;
}

export interface PlacementResult {
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  estimated_band: string;
  assigned_level_key: PresetLevel;
  initial_word_count: number;
  unlocked_checkpoints: number;
  target_band: string;
  fsrs_params?: {
    stability: number;
    target_retention: number;
  };
  feedback?: string;
}

export const DiagnosticSubmissionSchema = z.object({
  answers: z.record(z.string(), z.number()),
  user_id: z.string().optional()
});
