import { describe, it, expect } from 'vitest';
import { analyticsService } from '../../src/services/analytics.service.js';

describe('AnalyticsService Unit Tests (Dynamic Analytics & Invariant 07 Zero-Mockup)', () => {
  it('extracts genuine trap distribution from Cambridge 21 exam corpus', () => {
    const distribution = analyticsService.getTrapDistribution();

    expect(distribution).toBeDefined();
    expect(distribution['[TRAP-PARAPHRASE]']).toBe(62);
    expect(distribution['[NOT-GIVEN / OVER-INFERENCE]']).toBe(7);
    expect(distribution['[TRAP-ATTRIBUTION]']).toBe(6);
    expect(distribution['[TRAP-EXTREME]']).toBe(5);

    const totalQuestions = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    expect(totalQuestions).toBe(80);
  });

  it('queries completed reading tests from exam_submissions', () => {
    const count = analyticsService.getCompletedTestsCount('default_user');
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);

    const customCount = analyticsService.getCompletedTestsCount('non_existent_user_xyz');
    expect(typeof customCount).toBe('number');
    expect(customCount).toBeGreaterThanOrEqual(0);
  });

  it('computes full asynchronous dashboard summary with accurate tiers and statistics', async () => {
    const summary = await analyticsService.getDashboardSummary('default_user');

    expect(summary).toBeDefined();
    expect(summary.target_band).toBeDefined();
    expect(summary.total_vocab_count).toBeGreaterThanOrEqual(450);
    expect(summary.available_tests_count).toBeGreaterThanOrEqual(5);
    expect(summary.completed_tests).toBeGreaterThanOrEqual(0);

    // Vocab stats
    expect(summary.vocab_stats).toBeDefined();
    expect(summary.vocab_stats.total).toBe(summary.total_vocab_count);
    expect(summary.vocab_stats.reviewed).toBeGreaterThanOrEqual(0);
    expect(summary.vocab_stats.avgScore).toBeGreaterThanOrEqual(1.0);
    expect(summary.vocab_stats.avgScore).toBeLessThanOrEqual(7.0);

    // Vocab tiers
    const tiers = summary.vocab_tiers;
    expect(tiers).toBeDefined();
    expect(tiers.tier_mastered).toBeGreaterThanOrEqual(0);
    expect(tiers.tier_solid).toBeGreaterThanOrEqual(0);
    expect(tiers.tier_learning).toBeGreaterThanOrEqual(0);
    expect(tiers.tier_passive).toBeGreaterThanOrEqual(0);

    const tierTotal = tiers.tier_mastered + tiers.tier_solid + tiers.tier_learning + tiers.tier_passive;
    expect(tierTotal).toBe(summary.total_vocab_count);

    // Learned count
    expect(summary.learned_vocab_count).toBe(tiers.tier_mastered + tiers.tier_solid);

    // Trap distribution
    expect(summary.trap_distribution).toBeDefined();
    expect(summary.trap_distribution['[TRAP-PARAPHRASE]']).toBe(62);

    // Tier distribution contract
    expect(summary.tier_distribution).toBeDefined();
    expect(summary.tier_distribution!['Tier 1 (1.0 - 2.0)']).toBe(tiers.tier_learning);
    expect(summary.tier_distribution!['Tier 2 (2.0 - 4.0)']).toBe(tiers.tier_solid);
    expect(summary.tier_distribution!['Tier 3 (4.0 - 6.0)']).toBe(tiers.tier_mastered);
    expect(summary.tier_distribution!['Tier 4 (6.0 - 7.0)']).toBe(Math.floor(tiers.tier_mastered * 0.4));

    // Gamification properties
    expect(typeof summary.streak_days).toBe('number');
    expect(typeof summary.coins).toBe('number');
    expect(typeof summary.xp).toBe('number');
  });

  it('supports custom userId without throwing errors', async () => {
    const summary = await analyticsService.getDashboardSummary('user_isolated_test_123');
    expect(summary).toBeDefined();
    expect(summary.total_vocab_count).toBeGreaterThanOrEqual(450);
    expect(summary.vocab_tiers).toBeDefined();
  });
});
