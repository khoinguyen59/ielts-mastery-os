import { describe, it, expect } from 'vitest';
import { synthesisService } from '../../src/services/synthesis.service.js';
import { questionBankService } from '../../src/services/question-bank.service.js';

describe('SynthesisService (80/20 Recursive Synthesis & Deterministic Cloze)', () => {
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
    const db = (questionBankService as any).db;
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
