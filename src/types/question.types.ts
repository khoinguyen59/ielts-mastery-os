import { z } from 'zod';

export type QuestionStatus = 
  | 'active'
  | 'under_review_v1'
  | 'under_review_v2'
  | 'under_admin_review'
  | 'rejected'
  | 'archived';

export interface QuestionDTO {
  id: string;
  target_word_id: string;
  target_word?: string;
  embedded_word_ids: string[];
  prompt: string;
  masked_sentence?: string;
  options: string[];
  correct_index: number;
  explanation: string;
  error_tag?: string;
  band_75_upgrade?: string;
  band_85_upgrade?: string;
  status: QuestionStatus;
  quality_tags: string[];
  created_at?: string;
  badge?: string;
  morph_stage?: number;
  chain_id?: string;
  chain_step?: number;
  chain_badge?: string;
  word_details?: {
    collocation?: string;
    paraphrase?: string;
    derivatives?: string;
    embedded_words?: Array<{ id?: string; word: string; meaning: string }>;
  };
}

export const QuestionSchema = z.object({
  id: z.string(),
  target_word_id: z.string(),
  target_word: z.string().optional(),
  embedded_word_ids: z.array(z.string()).default([]),
  prompt: z.string(),
  masked_sentence: z.string().optional(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().default(''),
  error_tag: z.string().optional(),
  band_75_upgrade: z.string().optional(),
  band_85_upgrade: z.string().optional(),
  status: z.enum([
    'active',
    'under_review_v1',
    'under_review_v2',
    'under_admin_review',
    'rejected',
    'archived'
  ]).default('active'),
  quality_tags: z.array(z.string()).default([]),
  badge: z.string().optional(),
  morph_stage: z.number().optional(),
  chain_id: z.string().optional(),
  chain_step: z.number().optional(),
  chain_badge: z.string().optional(),
  word_details: z.any().optional()
});
