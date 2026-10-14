import { z } from 'zod';

export type FeedbackReason = 
  | 'ambiguous_answer'
  | 'two_correct_answers'
  | 'grammar_typo'
  | 'incorrect_explanation'
  | 'wrong_collocation'
  | 'other';

export interface FeedbackSubmissionDTO {
  question_id: string;
  user_id: string;
  reason: FeedbackReason;
  details?: string;
}

export interface UserTrustMetrics {
  user_id: string;
  trust_score: number;
  coins: number;
  feedback_count_today: number;
}

export const FeedbackSubmissionSchema = z.object({
  question_id: z.string(),
  user_id: z.string().default('default_user'),
  reason: z.enum([
    'ambiguous_answer',
    'two_correct_answers',
    'grammar_typo',
    'incorrect_explanation',
    'wrong_collocation',
    'other'
  ]),
  details: z.string().optional()
});
