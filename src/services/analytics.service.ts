import { vocabService } from './vocab.service.js';
import { examService } from './exam.service.js';
import { userService } from './user.service.js';

export interface AnalyticsSummary {
  target_band: string;
  total_vocab_count: number;
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
  available_tests_count: number;
  user_stats?: unknown;
}

export class AnalyticsService {
  public getDashboardSummary(userId: string = 'default_user'): AnalyticsSummary {
    const vStats = vocabService.getVocabStats(userId);
    const passages = examService.getAllPassages();
    const allWords = vocabService.getAllVocab(userId);
    const userStats = userService.getUserStats(userId);

    const tiers = {
      tier_mastered: allWords.filter(w => w.score >= 5.0).length,
      tier_solid: allWords.filter(w => w.score >= 3.0 && w.score < 5.0).length,
      tier_learning: allWords.filter(w => w.score >= 1.0 && w.score < 3.0).length,
      tier_passive: allWords.filter(w => w.score < 1.0).length
    };

    const trapDistribution: Record<string, number> = {
      '[TRAP-PARAPHRASE]': 18,
      '[Y/N/NG]': 12,
      '[ATTRIBUTION]': 6,
      '[ONE-WORD]': 14,
      '[DATA-SCAN]': 5
    };

    return {
      target_band: '7.5 - 8.5+',
      total_vocab_count: allWords.length,
      vocab_stats: vStats,
      vocab_tiers: tiers,
      trap_distribution: trapDistribution,
      available_tests_count: passages.length,
      user_stats: userStats
    };
  }
}

export const analyticsService = new AnalyticsService();
