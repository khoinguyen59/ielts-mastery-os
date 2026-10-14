import { describe, it, expect } from 'vitest';
import { questionBankService } from '../../src/services/question-bank.service.js';
import { getDatabase, ensureUserExists } from '../../src/db/sqlite.js';

describe('QuestionBankService (Tri-Tier Lifecycle & Feedback Economics)', () => {
  const db = getDatabase();

  it('retrieves questions and updates status', () => {
    const q = questionBankService.getQuestionById('q_seed_1');
    expect(q).not.toBeNull();
    if (q) {
      expect(q.id).toBe('q_seed_1');
      expect(q.options).toHaveLength(4);

      questionBankService.updateQuestionStatus('q_seed_1', 'under_review_v1');
      const updated = questionBankService.getQuestionById('q_seed_1');
      expect(updated?.status).toBe('under_review_v1');

      // Revert to active
      questionBankService.updateQuestionStatus('q_seed_1', 'active');
    }
  });

  it('handles feedback submission with rate limiting and trust score dynamics', () => {
    const testUser = 'user_test_fb';
    ensureUserExists(testUser, db);
    db.prepare("DELETE FROM question_feedback_logs WHERE user_id = ?").run(testUser);
    db.prepare(`
      INSERT OR REPLACE INTO user_stats (user_id, coins, trust_score)
      VALUES (?, 100, 1.0)
    `).run(testUser);

    const submission = {
      question_id: 'q_seed_2',
      user_id: testUser,
      reason: 'two_correct_answers' as const,
      details: 'Options A and B both fit the collocation.'
    };

    const res = questionBankService.submitFeedback(submission);
    expect(res.success).toBe(true);

    // Verify feedback log inserted
    const log = db.prepare('SELECT * FROM question_feedback_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(testUser) as any;
    expect(log).toBeDefined();

    // Test resolving feedback as valid (+10 coins)
    const resolveRes = questionBankService.resolveFeedback(log.id, true);
    expect(resolveRes.rewardCoins).toBe(10);

    const metrics = questionBankService.getUserTrustMetrics(testUser);
    expect(metrics.coins).toBe(110);
    expect(metrics.trust_score).toBe(1.0);
  });

  it('escalates question status to under_review_v2 when 3 distinct users submit feedback within 30 days', () => {
    const testQId = 'q_test_escalate_3users';
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);

    // Insert test question
    db.prepare(`
      INSERT INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, status)
      VALUES (?, '#001', '[]', 'Prompt for escalate test', 'Sentence _______', '["A","B","C","D"]', 0, 'active')
    `).run(testQId);

    const users = ['user_esc_1', 'user_esc_2', 'user_esc_3'];
    for (const u of users) {
      ensureUserExists(u, db);
      db.prepare("INSERT OR REPLACE INTO user_stats (user_id, coins, trust_score) VALUES (?, 100, 0.5)").run(u);
    }

    // 1st user feedback: distinct = 1 -> not under_review_v2
    questionBankService.submitFeedback({
      question_id: testQId,
      user_id: users[0],
      reason: 'ambiguous_answer',
      details: 'First report'
    });
    expect(questionBankService.getQuestionById(testQId)?.status).not.toBe('under_review_v2');

    // 2nd user feedback: distinct = 2 -> not under_review_v2
    questionBankService.submitFeedback({
      question_id: testQId,
      user_id: users[1],
      reason: 'ambiguous_answer',
      details: 'Second report'
    });
    expect(questionBankService.getQuestionById(testQId)?.status).not.toBe('under_review_v2');

    // 3rd user feedback: distinct = 3 -> escalates to under_review_v2!
    questionBankService.submitFeedback({
      question_id: testQId,
      user_id: users[2],
      reason: 'two_correct_answers',
      details: 'Third report triggers AI-Validator-2'
    });
    expect(questionBankService.getQuestionById(testQId)?.status).toBe('under_review_v2');

    // Cleanup
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);
  });

  it('escalates question status to under_review_v2 when single user submits >= 2 reports', () => {
    const testQId = 'q_test_escalate_single_user';
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);

    db.prepare(`
      INSERT INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, status)
      VALUES (?, '#001', '[]', 'Prompt for single user test', 'Sentence _______', '["A","B","C","D"]', 0, 'active')
    `).run(testQId);

    const testUser = 'user_esc_single';
    ensureUserExists(testUser, db);
    db.prepare("INSERT OR REPLACE INTO user_stats (user_id, coins, trust_score) VALUES (?, 100, 0.5)").run(testUser);

    // 1st report: this_user_reports = 1
    questionBankService.submitFeedback({
      question_id: testQId,
      user_id: testUser,
      reason: 'grammar_typo',
      details: 'First report from single user'
    });
    expect(questionBankService.getQuestionById(testQId)?.status).not.toBe('under_review_v2');

    // 2nd report: this_user_reports = 2 -> escalates to under_review_v2
    questionBankService.submitFeedback({
      question_id: testQId,
      user_id: testUser,
      reason: 'grammar_typo',
      details: 'Second report from single user'
    });
    expect(questionBankService.getQuestionById(testQId)?.status).toBe('under_review_v2');

    // Cleanup
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);
  });

  it('permanently marks question as rejected when feedback is resolved as valid', () => {
    const testQId = 'q_test_reject_resolution';
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);

    db.prepare(`
      INSERT INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, status)
      VALUES (?, '#001', '[]', 'Prompt for reject resolution', 'Sentence _______', '["A","B","C","D"]', 0, 'active')
    `).run(testQId);

    const testUser = 'user_resolve_valid';
    ensureUserExists(testUser, db);

    const sub = questionBankService.submitFeedback({
      question_id: testQId,
      user_id: testUser,
      reason: 'two_correct_answers',
      details: 'Confirmed two valid options'
    });
    expect(sub.success).toBe(true);

    const log = db.prepare('SELECT id FROM question_feedback_logs WHERE question_id = ?').get(testQId) as any;
    expect(log).toBeDefined();

    // Resolving with isValid = true must update status to 'rejected'
    const resolveResult = questionBankService.resolveFeedback(log.id, true);
    expect(resolveResult.success).toBe(true);

    const q = questionBankService.getQuestionById(testQId);
    expect(q?.status).toBe('rejected');

    // Cleanup
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);
  });

  it('restores question status to active when feedback is resolved as invalid', () => {
    const testQId = 'q_test_reject_invalid';
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);

    db.prepare(`
      INSERT INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, status)
      VALUES (?, '#001', '[]', 'Prompt for invalid feedback', 'Sentence _______', '["A","B","C","D"]', 0, 'under_review_v1')
    `).run(testQId);

    const testUser = 'user_resolve_invalid';
    ensureUserExists(testUser, db);

    const sub = questionBankService.submitFeedback({
      question_id: testQId,
      user_id: testUser,
      reason: 'grammar_typo',
      details: 'Mistaken claim'
    });
    expect(sub.success).toBe(true);

    const log = db.prepare('SELECT id FROM question_feedback_logs WHERE question_id = ?').get(testQId) as any;
    expect(log).toBeDefined();

    // Resolving with isValid = false must restore status to 'active'
    const resolveResult = questionBankService.resolveFeedback(log.id, false);
    expect(resolveResult.success).toBe(true);

    const q = questionBankService.getQuestionById(testQId);
    expect(q?.status).toBe('active');

    // Cleanup
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);
  });
});
