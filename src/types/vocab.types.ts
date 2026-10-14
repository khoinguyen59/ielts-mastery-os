import { z } from 'zod';

export interface DerivativeItem {
  id: string;
  word: string;
  pos: string;
  meaning: string;
}

export interface VocabWord {
  id: string;
  word: string;
  pos: string;
  ipa: string;
  meaning: string;
  extended_meaning?: string;
  score: number;
  synonym: string;
  paraphrase: string;
  antonym: string;
  key_collocation: string;
  collocations: string;
  example: string;
  lego_roots: string;
  word_family: DerivativeItem[];
  derivatives: DerivativeItem[];
  nuance_50?: string;
}

export interface FSRSProgress {
  user_id?: string;
  word_id: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  due_date: string | null;
  last_review: string | null;
  current_score: number;
  updated_at?: string;
}

export const VocabWordSchema = z.object({
  id: z.string(),
  word: z.string(),
  pos: z.string(),
  ipa: z.string().default(''),
  meaning: z.string(),
  extended_meaning: z.string().optional(),
  score: z.number().default(1.0),
  synonym: z.string().default(''),
  antonym: z.string().default(''),
  key_collocation: z.string().default(''),
  example: z.string().default(''),
  lego_roots: z.string().default(''),
  word_family: z.array(z.any()).default([]),
  derivatives: z.array(z.any()).default([]),
  nuance_50: z.string().optional()
});
