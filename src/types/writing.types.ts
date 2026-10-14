export interface WritingTargetWord {
  id: string;
  word: string;
  pos: string;
  core: string;
  colloc: string;
}

export interface WritingChunk {
  id: string;
  unit: number;
  title: string;
  topic: string;
  target_words: WritingTargetWord[];
  vietnamese_prompt: string;
  minimalist_clues: string[];
  band_75_model: string;
  band_85_model: string;
}

export interface WritingEvaluationRequest {
  chunk_id: string;
  user_submission: string;
  user_id?: string;
}

export interface WritingEvaluationResponse {
  chunk_id: string;
  word_count: number;
  used_target_words: string[];
  missing_target_words: string[];
  coverage_ratio: number;
  band_estimate: string;
  band_75_model: string;
  band_85_model: string;
  feedback: string;
}
