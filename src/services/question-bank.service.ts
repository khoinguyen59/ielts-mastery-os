import { getDatabase } from '../db/sqlite.js';
import { FeedbackReason, FeedbackSubmissionDTO, UserTrustMetrics } from '../types/feedback.types.js';
import { QuestionDTO, QuestionStatus } from '../types/question.types.js';

export class QuestionBankService {
  private db = getDatabase();

  public getQuestionById(id: string): QuestionDTO | null {
    const row = this.db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRowToQuestion(row);
  }

  public updateQuestionStatus(id: string, status: QuestionStatus): boolean {
    const res = this.db.prepare('UPDATE questions SET status = ? WHERE id = ?').run(status, id);
    return res.changes > 0;
  }

  public submitFeedback(submission: FeedbackSubmissionDTO): {
    success: boolean;
    message: string;
    metrics: UserTrustMetrics;
  } {
    const userId = submission.user_id || 'default_user';
    const metrics = this.getUserTrustMetrics(userId);

    // Rate limiting: Max 10 feedbacks per day
    if (metrics.feedback_count_today >= 10) {
      return {
        success: false,
        message: 'Bạn đã đạt giới hạn 10 lượt báo lỗi mỗi ngày. Vui lòng thử lại vào ngày mai.',
        metrics
      };
    }

    // Insert log
    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.db.prepare(`
      INSERT INTO question_feedback_logs (id, question_id, user_id, reason, details, review_stage, reward_coins)
      VALUES (?, ?, ?, ?, ?, 'pending_v1', 0)
    `).run(feedbackId, submission.question_id, userId, submission.reason, submission.details || '');

    // If user has high trust score (>= 0.7), move question to under_review_v1
    if (metrics.trust_score >= 0.7) {
      this.db.prepare(`
        UPDATE questions SET status = 'under_review_v1' WHERE id = ?
      `).run(submission.question_id);
    }

    const updatedMetrics = this.getUserTrustMetrics(userId);
    return {
      success: true,
      message: 'Báo lỗi đã được tiếp nhận và đưa vào hệ thống kiểm định đối chứng 3 tầng.',
      metrics: updatedMetrics
    };
  }

  public resolveFeedback(feedbackId: string, isValid: boolean): {
    success: boolean;
    rewardCoins: number;
    newTrustScore: number;
  } {
    const fb = this.db.prepare('SELECT * FROM question_feedback_logs WHERE id = ?').get(feedbackId) as any;
    if (!fb) {
      return { success: false, rewardCoins: 0, newTrustScore: 1.0 };
    }

    const userId = fb.user_id;
    let coinsDelta = isValid ? 10 : -5;
    let trustDelta = isValid ? 0.05 : -0.1;

    // Update feedback row
    this.db.prepare(`
      UPDATE question_feedback_logs
      SET review_stage = ?, reward_coins = ?
      WHERE id = ?
    `).run(isValid ? 'resolved_valid' : 'resolved_invalid', coinsDelta, feedbackId);

    // Update user stats
    const user = this.db.prepare('SELECT coins, trust_score FROM user_stats WHERE user_id = ?').get(userId) as any;
    const currentCoins = user ? user.coins : 100;
    const currentTrust = user ? user.trust_score : 1.0;

    const newCoins = Math.max(0, currentCoins + coinsDelta);
    const newTrust = Math.max(0.1, Math.min(1.0, Number((currentTrust + trustDelta).toFixed(2))));

    this.db.prepare(`
      UPDATE user_stats
      SET coins = ?, trust_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newCoins, newTrust, userId);

    // Update question status
    if (isValid) {
      this.db.prepare("UPDATE questions SET status = 'under_admin_review' WHERE id = ?").run(fb.question_id);
    } else {
      this.db.prepare("UPDATE questions SET status = 'active' WHERE id = ?").run(fb.question_id);
    }

    return { success: true, rewardCoins: coinsDelta, newTrustScore: newTrust };
  }

  public getUserTrustMetrics(userId: string): UserTrustMetrics {
    const today = new Date().toISOString().slice(0, 10);
    const user = this.db.prepare('SELECT coins, trust_score FROM user_stats WHERE user_id = ?').get(userId) as any;
    
    const countRow = this.db.prepare(`
      SELECT count(*) as count FROM question_feedback_logs
      WHERE user_id = ? AND date(created_at) = ?
    `).get(userId, today) as { count: number };

    return {
      user_id: userId,
      coins: user ? user.coins : 100,
      trust_score: user ? user.trust_score : 1.0,
      feedback_count_today: countRow ? countRow.count : 0
    };
  }

  private mapRowToQuestion(row: any): QuestionDTO {
    return {
      id: row.id,
      target_word_id: row.target_word_id,
      embedded_word_ids: JSON.parse(row.embedded_word_ids || '[]'),
      prompt: row.prompt,
      masked_sentence: row.masked_sentence,
      options: JSON.parse(row.options || '[]'),
      correct_index: row.correct_index,
      explanation: row.explanation,
      error_tag: row.error_tag,
      band_75_upgrade: row.band_75_upgrade,
      band_85_upgrade: row.band_85_upgrade,
      status: row.status,
      quality_tags: JSON.parse(row.quality_tags || '[]'),
      created_at: row.created_at
    };
  }
}

export const questionBankService = new QuestionBankService();
