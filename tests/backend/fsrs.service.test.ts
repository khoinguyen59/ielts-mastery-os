import { describe, it, expect, beforeEach } from 'vitest';
import { fsrsService } from '../../src/services/fsrs.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

describe('FSRSService (ts-fsrs v5 & Invariant 18 Scoring)', () => {
  const db = getDatabase();

  beforeEach(() => {
    // Ensure word exists in words table for foreign key constraint
    db.prepare(`
      INSERT OR IGNORE INTO words (id, word, pos, meaning)
      VALUES ('test_fsrs_word', 'test_word', 'v', 'test meaning')
    `).run();
    // Reset test word progress
    db.prepare('DELETE FROM user_vocab_progress WHERE word_id = ?').run('test_fsrs_word');
  });

  it('initializes a new card with score 1.0', () => {
    const card = fsrsService.getCard('test_fsrs_word');
    expect(card.current_score).toBe(1.0);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
  });

  it('increments reps and score on successful review (Rating.Good = 3)', () => {
    const { progress, newScore } = fsrsService.reviewWord('test_fsrs_word', 3);
    expect(progress.reps).toBe(1);
    expect(newScore).toBeGreaterThanOrEqual(2.0);
    expect(progress.due_date).toBeDefined();

    const secondReview = fsrsService.reviewWord('test_fsrs_word', 3);
    expect(secondReview.progress.reps).toBe(2);
    expect(secondReview.newScore).toBeGreaterThanOrEqual(3.0);
  });

  it('records lapse and reduces score on failed review (Rating.Again = 1)', () => {
    fsrsService.reviewWord('test_fsrs_word', 3); // initial good
    const lapsed = fsrsService.reviewWord('test_fsrs_word', 1);

    expect(lapsed.progress.lapses).toBe(1);
    expect(lapsed.newScore).toBeLessThanOrEqual(2.0);
  });

  it('retrieves learned word IDs with score >= 2.0', () => {
    fsrsService.reviewWord('test_fsrs_word', 3);
    const learned = fsrsService.getLearnedWordIds(2.0);
    expect(learned).toContain('test_fsrs_word');
  });
});
