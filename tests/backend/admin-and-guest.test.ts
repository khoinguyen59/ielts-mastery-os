import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { feedbackRoutes } from '../../src/api/routes/feedback.routes.js';
import { authRoutes } from '../../src/api/routes/auth.routes.js';
import { questionBankService } from '../../src/services/question-bank.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

describe('Admin Questions Review & Guest Data Sync API', () => {
  const app = Fastify();
  const db = getDatabase();

  beforeAll(async () => {
    await app.register(cors);
    await app.register(feedbackRoutes);
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows admin to fetch pending review questions and decide approval/rejection', async () => {
    const testQId = 'q_admin_test_dispute_1';
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);

    db.prepare(`
      INSERT INTO questions (id, target_word_id, embedded_word_ids, prompt, masked_sentence, options, correct_index, status, quality_tags)
      VALUES (?, '#001', '[]', 'Admin dispute question prompt', 'Sentence _______', '["A","B","C","D"]', 0, 'under_admin_review', '[]')
    `).run(testQId);

    const reporter = 'user_admin_reporter_1';
    db.prepare("INSERT OR IGNORE INTO users (id, username, display_name) VALUES (?, 'rep1', 'Reporter')").run(reporter);
    db.prepare("INSERT OR REPLACE INTO user_stats (user_id, coins, trust_score) VALUES (?, 100, 1.0)").run(reporter);

    db.prepare(`
      INSERT INTO question_feedback_logs (id, question_id, user_id, reason, details, review_stage, reward_coins)
      VALUES ('fb_adm_1', ?, ?, 'ambiguous_answer', 'Dispute reported', 'pending_v1', 0)
    `).run(testQId, reporter);

    // 1. GET /api/admin/questions/pending
    const pendingRes = await app.inject({ method: 'GET', url: '/api/admin/questions/pending' });
    expect(pendingRes.statusCode).toBe(200);
    const pendingData = JSON.parse(pendingRes.body);
    expect(pendingData.success).toBe(true);
    expect(pendingData.data.some((q: any) => q.id === testQId)).toBe(true);

    // 2. POST /api/admin/questions/:id/decide with approve
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/admin/questions/${testQId}/decide`,
      payload: { decision: 'approve', notes: 'Verified by chief academic lead' }
    });
    expect(approveRes.statusCode).toBe(200);
    const approveData = JSON.parse(approveRes.body);
    expect(approveData.success).toBe(true);

    const qAfterApprove = questionBankService.getQuestionById(testQId);
    expect(qAfterApprove?.status).toBe('active');
    expect(qAfterApprove?.quality_tags).toContain('admin_verified');

    // 3. Test reject decision
    db.prepare("UPDATE questions SET status = 'under_admin_review' WHERE id = ?").run(testQId);
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/admin/questions/${testQId}/decide`,
      payload: { decision: 'reject' }
    });
    expect(rejectRes.statusCode).toBe(200);
    const qAfterReject = questionBankService.getQuestionById(testQId);
    expect(qAfterReject?.status).toBe('rejected');

    // 4. Test auto-unlock
    const autoUnlockRes = await app.inject({ method: 'POST', url: '/api/admin/questions/auto-unlock' });
    expect(autoUnlockRes.statusCode).toBe(200);
    expect(JSON.parse(autoUnlockRes.body).success).toBe(true);

    // Cleanup
    db.prepare('DELETE FROM question_feedback_logs WHERE question_id = ?').run(testQId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(testQId);
    db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(reporter);
    db.prepare('DELETE FROM users WHERE id = ?').run(reporter);
  });

  it('merges guest scores, streak, and coins via POST /api/auth/sync-guest', async () => {
    const testUserId = `usr_sync_${Date.now()}`;
    db.prepare("INSERT INTO users (id, username, display_name) VALUES (?, 'sync_usr', 'Sync User')").run(testUserId);
    db.prepare("INSERT INTO user_stats (user_id, coins, streak_days, xp) VALUES (?, 100, 1, 0)").run(testUserId);

    const guestPayload = {
      userId: testUserId,
      scores: {
        '#001': { score: 5.5 },
        '#002': { score: 4.0 }
      },
      streak: { current: 7, best: 10 },
      coins: 250,
      xp: 120
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sync-guest',
      payload: guestPayload
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.mergedCount).toBeGreaterThanOrEqual(2);

    const stats = db.prepare('SELECT coins, streak_days, xp FROM user_stats WHERE user_id = ?').get(testUserId) as any;
    expect(stats.coins).toBe(250);
    expect(stats.streak_days).toBe(7);
    expect(stats.xp).toBe(120);

    const vocabProgress = db.prepare('SELECT current_score FROM user_vocab_progress WHERE user_id = ? AND word_id = ?').get(testUserId, '#001') as any;
    expect(vocabProgress.current_score).toBe(5.5);

    // Cleanup
    db.prepare('DELETE FROM user_vocab_progress WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });
});
