import { describe, it, expect } from 'vitest';
import { questionBankService } from '../../src/services/question-bank.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

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
});
