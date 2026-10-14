import { describe, it, expect } from 'vitest';
import { writingService } from '../../src/services/writing.service.js';
import { getDatabase, ensureUserExists } from '../../src/db/sqlite.js';

describe('WritingService Micro-Chunks & Band Upgrades', () => {
  it('loads predefined IELTS Task 2 micro-chunks', () => {
    const chunks = writingService.getChunks();
    expect(chunks.length).toBeGreaterThanOrEqual(4);

    const chunk1 = writingService.getChunkById('chunk_01');
    expect(chunk1).toBeDefined();
    expect(chunk1?.title).toContain('Giáo dục Đại học');
    expect(chunk1?.band_75_model).toContain('contemporary society');
    expect(chunk1?.band_85_model).toContain('tertiary education');
  });

  it('evaluates student writing and detects target academic vocabulary with AI semantic scoring', async () => {
    const goodTranslation = 'In contemporary society, the bulk of young individuals choose to establish a foundation for work.';
    const result = await writingService.evaluateTranslation('chunk_01', goodTranslation);

    expect(result.chunk_id).toBe('chunk_01');
    expect(result.used_target_words).toContain('contemporary');
    expect(result.used_target_words).toContain('bulk');
    expect(result.used_target_words).toContain('establish');
    expect(result.coverage_ratio).toBe(1.0);
    expect(result.score_ratio).toBeGreaterThanOrEqual(0.0);
    expect(result.score_ratio).toBeLessThanOrEqual(1.0);
    expect(result.similarity_score).toBeDefined();
    expect(result.similarity_score).toBeGreaterThanOrEqual(0.0);
    expect(result.similarity_score).toBeLessThanOrEqual(1.0);
    expect(result.band_estimate).toContain('7.5');
    expect(result.band_75_model).toBeDefined();
    expect(result.band_85_model).toBeDefined();
  });

  it('warns when target words are missing or sentence is too short', async () => {
    const briefTranslation = 'Young people study.';
    const result = await writingService.evaluateTranslation('chunk_01', briefTranslation);

    expect(result.missing_target_words.length).toBeGreaterThan(0);
    expect(result.feedback).toContain('ngắn');
    expect(result.coverage_ratio).toBeLessThan(0.5);
    expect(result.score_ratio).toBeGreaterThanOrEqual(0.0);
    expect(result.score_ratio).toBeLessThanOrEqual(1.0);
  });

  it('enforces anti-demotion safeguard for already mastered vocabulary (score 7.0)', async () => {
    const db = getDatabase();
    const userId = 'test_demotion_safe_user';
    ensureUserExists(userId, db);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_vocab_progress (user_id, word_id, stability, difficulty, reps, lapses, state, due_date, current_score)
      VALUES (?, ?, 15.0, 1.0, 10, 0, 2, ?, 7.0)
      ON CONFLICT(user_id, word_id) DO UPDATE SET current_score = 7.0
    `).run(userId, '#118', now);

    const goodTranslation = 'In contemporary society, the bulk of young individuals choose to establish a foundation for work.';
    const result = await writingService.evaluateTranslation('chunk_01', goodTranslation, userId);

    expect(result.used_target_words).toContain('contemporary');

    const progressRow = db.prepare(`
      SELECT current_score FROM user_vocab_progress WHERE user_id = ? AND word_id = ?
    `).get(userId, '#118') as { current_score: number } | undefined;

    expect(progressRow).toBeDefined();
    expect(progressRow?.current_score).toBe(7.0);
  });
});
