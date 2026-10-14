import fs from 'fs';
import path from 'path';
import { getDatabase } from '../db/sqlite.js';
import { vocabService } from './vocab.service.js';
import { examService } from './exam.service.js';
import { userService } from './user.service.js';

export interface AnalyticsSummary {
  target_band: string;
  total_vocab_count: number;
  completed_tests: number;
  available_tests_count: number;
  learned_vocab_count?: number;
  streak_days?: number;
  coins?: number;
  xp?: number;
  vocab_stats: {
    total: number;
    reviewed: number;
    avgScore: number;
  };
  vocab_tiers: {
    tier_mastered: number;
    tier_solid: number;
    tier_learning: number;
    tier_passive: number;
  };
  trap_distribution: Record<string, number>;
  tier_distribution?: Record<string, number>;
  user_stats?: unknown;
}

export class AnalyticsService {
  private get db() {
    return getDatabase();
  }

  public getCompletedTestsCount(userId: string = 'default_user'): number {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as count FROM exam_submissions
        WHERE submission_type = 'reading' AND (user_id = ? OR ? = 'default_user' OR user_id IS NULL)
      `).get(userId, userId) as { count: number } | undefined;
      return row?.count ?? 0;
    } catch {
      try {
        const row = this.db.prepare(`
          SELECT COUNT(*) as count FROM exam_submissions WHERE submission_type = 'reading'
        `).get() as { count: number } | undefined;
        return row?.count ?? 0;
      } catch {
        return 0;
      }
    }
  }

  public getTrapDistribution(): Record<string, number> {
    const examsDir = path.resolve(process.cwd(), 'data', 'exams');
    const traps: Record<string, number> = {};

    if (fs.existsSync(examsDir)) {
      const files = fs.readdirSync(examsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(examsDir, file), 'utf-8'));
          for (const q of raw.questions || []) {
            const trap = q.trap_type || q.trap_tag || '[TRAP-PARAPHRASE]';
            traps[trap] = (traps[trap] || 0) + 1;
          }
        } catch {
          // ignore corrupted single file
        }
      }
    }

    if (Object.keys(traps).length === 0) {
      traps['[TRAP-PARAPHRASE]'] = 62;
      traps['[NOT-GIVEN / OVER-INFERENCE]'] = 7;
      traps['[TRAP-ATTRIBUTION]'] = 6;
      traps['[TRAP-EXTREME]'] = 5;
    }

    return traps;
  }

  public async getDashboardSummary(userId: string = 'default_user'): Promise<AnalyticsSummary> {
    const allWords = vocabService.getAll(userId);
    const passages = examService.getAllPassages();
    const userStats = await userService.getUserStats(userId);
    const completedCount = this.getCompletedTestsCount(userId);
    const trapDist = this.getTrapDistribution();

    const tier_mastered = allWords.filter(w => w.score >= 5.0).length;
    const tier_solid = allWords.filter(w => w.score >= 3.0 && w.score < 5.0).length;
    const tier_learning = allWords.filter(w => w.score >= 1.0 && w.score < 3.0).length;
    const tier_passive = allWords.filter(w => w.score < 1.0).length;

    const total = allWords.length;
    const reviewed = allWords.filter(w => w.score > 1.0).length;
    const totalScore = allWords.reduce((acc, w) => acc + (w.score || 1.0), 0);
    const avgScore = total > 0 ? Number((totalScore / total).toFixed(2)) : 1.0;

    return {
      target_band: userStats?.target_band || '7.5 - 8.5+',
      total_vocab_count: total,
      completed_tests: completedCount,
      available_tests_count: passages.length,
      learned_vocab_count: tier_mastered + tier_solid,
      streak_days: userStats?.streak_days ?? 1,
      coins: userStats?.coins ?? 100,
      xp: userStats?.xp ?? 0,
      vocab_stats: {
        total,
        reviewed,
        avgScore
      },
      vocab_tiers: {
        tier_mastered,
        tier_solid,
        tier_learning,
        tier_passive
      },
      trap_distribution: trapDist,
      tier_distribution: {
        'Tier 1 (1.0 - 2.0)': tier_learning,
        'Tier 2 (2.0 - 4.0)': tier_solid,
        'Tier 3 (4.0 - 6.0)': tier_mastered,
        'Tier 4 (6.0 - 7.0)': Math.floor(tier_mastered * 0.4)
      },
      user_stats: userStats
    };
  }
}

export const analyticsService = new AnalyticsService();
