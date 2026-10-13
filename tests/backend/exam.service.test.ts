import { describe, it, expect } from 'vitest';
import { examService } from '../../src/services/exam.service.js';

describe('ExamService Unit Tests (Cambridge 21 & Reading-to-Writing)', () => {
  it('loads all 5 Cambridge 21 passages with paragraphs and questions', () => {
    const passages = examService.getAllPassages();
    expect(passages.length).toBeGreaterThanOrEqual(5);

    for (const p of passages) {
      expect(p.id).toBeDefined();
      expect(p.title).toBeDefined();
      expect(p.paragraphs.length).toBeGreaterThanOrEqual(1);
      expect(p.questions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('evaluates reading test submissions with clue text and Linearthinking traps', () => {
    const passages = examService.getAllPassages();
    const passage = passages[0];
    const answers: Record<string, string> = {};

    // Answer first 2 questions with correct answers
    for (let i = 0; i < Math.min(2, passage.questions.length); i++) {
      const q = passage.questions[i];
      answers[q.number.toString()] = q.correct_answer.split('/')[0].trim();
    }

    const res = examService.evaluatePassageSubmission(passage.id, answers, 'test_user_reading');
    expect(res.passage_id).toBe(passage.id);
    expect(res.total_questions).toBe(passage.questions.length);
    expect(res.correct_answers).toBeGreaterThanOrEqual(1);
    expect(res.detailed_results).toHaveLength(passage.questions.length);

    for (const d of res.detailed_results) {
      expect(d.trap_type).toBeDefined();
      expect(d.explanation).toBeDefined();
    }
  });

  it('provides 4 Reading-to-Writing micro-chunks with academic models', () => {
    const chunks = examService.getWritingChunks();
    expect(chunks).toHaveLength(4);

    for (const c of chunks) {
      expect(c.id).toMatch(/^chunk_\d+$/);
      expect(c.target_words.length).toBeGreaterThanOrEqual(3);
      expect(c.minimalist_clues.length).toBeGreaterThanOrEqual(3);
      expect(c.band_75_model).toBeDefined();
      expect(c.band_85_model).toBeDefined();
    }
  });

  it('evaluates writing chunk submissions with vocabulary coverage and AI semantic matching', async () => {
    const chunk = examService.getWritingChunkById('chunk_01');
    expect(chunk).not.toBeNull();

    if (chunk) {
      const submissionText = 'In contemporary society, the bulk of young people opt to pursue higher education to establish a solid foundation.';
      const res = await examService.evaluateWritingChunk('chunk_01', submissionText, 'test_user_writing');

      expect(res.chunk_id).toBe('chunk_01');
      expect(res.matched_words).toContain('contemporary');
      expect(res.matched_words).toContain('bulk');
      expect(res.matched_words).toContain('establish');
      expect(res.similarity_score).toBeGreaterThan(0.5);
      expect(res.score_ratio).toBeGreaterThan(0.6);
      expect(res.estimated_band).toBeDefined();
    }
  });
});
