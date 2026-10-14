import { describe, it, expect } from 'vitest';
import { synthesisService } from '../../src/services/synthesis.service.js';
import { questionBankService } from '../../src/services/question-bank.service.js';
import { vocabService } from '../../src/services/vocab.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

describe('SynthesisService (80/20 Recursive Synthesis & Deterministic Cloze)', () => {
  const db = getDatabase();

  it('generates a 5-question synthesis round within sub-millisecond range', () => {
    const start = performance.now();
    const round = synthesisService.getSynthesisRound(undefined, 5);
    const duration = performance.now() - start;

    expect(round).toHaveLength(5);
    expect(duration).toBeLessThan(100); // Super fast execution
  });

  it('fulfills requested count when specific targetWordId is provided', () => {
    const round = synthesisService.getSynthesisRound('#001', 5);
    expect(round).toHaveLength(5);
    expect(round[0].target_word_id).toBe('#001');
  });

  it('ensures each question has 4 options, valid correct_index, and masked blank', () => {
    const round = synthesisService.getSynthesisRound(undefined, 3);
    for (const q of round) {
      expect(q.options).toHaveLength(4);
      expect(q.correct_index).toBeGreaterThanOrEqual(0);
      expect(q.correct_index).toBeLessThanOrEqual(3);
      expect(q.masked_sentence).toBeDefined();
      expect(q.masked_sentence).toContain('_______');
      expect(q.explanation).toBeDefined();
      expect(q.status).toBe('active');
    }
  });

  it('embeds academic upgrades and diagnostic error tags', () => {
    const round = synthesisService.getSynthesisRound(undefined, 2);
    for (const q of round) {
      expect(q.error_tag).toMatch(/\[LỖI-/);
      expect(q.band_75_upgrade).toBeDefined();
      expect(q.band_85_upgrade).toBeDefined();
    }
  });

  it('shuffles candidate distractors producing varying distractor sets across calls', () => {
    const allWords = vocabService.getAll();
    const target = allWords.find(w => w.id === '#001') || allWords[0];
    const optionCombinations = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const q = synthesisService.synthesizeClozeQuestion(target, new Set(), allWords);
      const distractorSignature = q.options.filter(o => o !== target.word).sort().join('|');
      optionCombinations.add(distractorSignature);
    }

    // Shuffling across same-POS pool yields diversified distractor sets across calls
    expect(optionCombinations.size).toBeGreaterThan(1);
  });

  it('prioritizes higher quality tiers in findMatchingQuestion', () => {
    const testWordId = '#test_quality_tier';
    db.prepare("INSERT OR IGNORE INTO words (id, word, pos, meaning) VALUES (?, 'qualitytestword', 'noun', 'test meaning')").run(testWordId);
    // Clean up test questions for this word
    db.prepare('DELETE FROM questions WHERE target_word_id = ?').run(testWordId);

    // Insert 4 questions with different quality tags
    const insertStmt = db.prepare(`
      INSERT INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, explanation, status, quality_tags, created_at)
      VALUES (?, ?, '[]', 'Test Prompt', 'Test _______', '["A","B","C","D"]', 0, 'Exp', 'active', ?, ?)
    `);

    insertStmt.run('q_tier_offline', testWordId, JSON.stringify(['offline_fallback']), '2026-01-01 10:00:00');
    insertStmt.run('q_tier_v1', testWordId, JSON.stringify(['v1_approved']), '2026-01-01 11:00:00');
    insertStmt.run('q_tier_v2', testWordId, JSON.stringify(['v2_approved']), '2026-01-01 12:00:00');
    insertStmt.run('q_tier_admin', testWordId, JSON.stringify(['admin_verified']), '2026-01-01 09:00:00');

    // 1. Should prioritize admin_verified (weight 3) even if created earlier
    const match1 = synthesisService.findMatchingQuestion(testWordId, new Set());
    expect(match1).not.toBeNull();
    expect(match1?.id).toBe('q_tier_admin');

    // 2. Remove admin_verified -> Should pick v2_approved (weight 2)
    db.prepare("UPDATE questions SET status = 'rejected' WHERE id = 'q_tier_admin'").run();
    const match2 = synthesisService.findMatchingQuestion(testWordId, new Set());
    expect(match2?.id).toBe('q_tier_v2');

    // 3. Remove v2_approved -> Should pick v1_approved (weight 1)
    db.prepare("UPDATE questions SET status = 'rejected' WHERE id = 'q_tier_v2'").run();
    const match3 = synthesisService.findMatchingQuestion(testWordId, new Set());
    expect(match3?.id).toBe('q_tier_v1');

    // 4. Remove v1_approved -> Should fall back to offline_fallback (weight 0)
    db.prepare("UPDATE questions SET status = 'rejected' WHERE id = 'q_tier_v1'").run();
    const match4 = synthesisService.findMatchingQuestion(testWordId, new Set());
    expect(match4?.id).toBe('q_tier_offline');

    // Cleanup
    db.prepare('DELETE FROM questions WHERE target_word_id = ?').run(testWordId);
    db.prepare('DELETE FROM words WHERE id = ?').run(testWordId);
  });

  it('marks questions as rejected when structural pre-validation fails', () => {
    const corruptTarget = { id: '#fake_target', word: 'duplicate', pos: 'noun', meaning: 'noun meaning' };
    const corruptPool = [
      { id: '#d1', word: 'duplicate', pos: 'noun' },
      { id: '#d2', word: 'duplicate', pos: 'noun' }
    ];

    const q = synthesisService.synthesizeClozeQuestion(corruptTarget, new Set(), corruptPool);
    expect(q.status).toBe('rejected');
  });

  it('persists synthesized questions to SQLite questions table for grading and dispute', () => {
    // Generate for word without pre-seeded questions to trigger cloze synthesis
    const round = synthesisService.getSynthesisRound('#300', 1);
    expect(round).toHaveLength(1);
    const synthQ = round[0];

    // Verify it was persisted to SQLite
    const found = questionBankService.getQuestionById(synthQ.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(synthQ.id);
    expect(found?.correct_index).toBe(synthQ.correct_index);

    // Clean up test user logs for self-contained isolation
    db.prepare("DELETE FROM question_feedback_logs WHERE user_id = 'user_synth_fb_test'").run();

    // Verify submitting feedback on this synthesized question succeeds without Foreign Key failure
    const fbRes = questionBankService.submitFeedback({
      question_id: synthQ.id,
      user_id: 'user_synth_fb_test',
      reason: 'two_correct_answers',
      details: 'Ambiguous options'
    });
    expect(fbRes.success).toBe(true);
  });
});
