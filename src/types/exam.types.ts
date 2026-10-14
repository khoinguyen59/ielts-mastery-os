export interface ExamQuestion {
  number: number;
  q_type: string;
  prompt: string;
  options?: string[];
  correct_answer: string;
  clue_paragraph: string;
  clue_text: string;
  explanation: string;
  trap_type: string;
  trap_tag?: string;
}

export interface ExamPassage {
  id: string;
  test_number: number;
  passage_number: number;
  title: string;
  subtitle?: string;
  paragraphs: Array<{ label: string; text: string }>;
  questions: ExamQuestion[];
  target_words: string[];
}

export interface ExamSubmission {
  passage_id: string;
  user_id?: string;
  answers: Record<string, string>;
}

export interface ExamQuestionResult {
  number: number;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  clue_paragraph: string;
  clue_text: string;
  explanation: string;
  trap_type: string;
}

export interface ExamEvaluationResult {
  passage_id: string;
  total_questions: number;
  correct_answers: number;
  score_ratio: number;
  estimated_band: string;
  detailed_results: ExamQuestionResult[];
}
