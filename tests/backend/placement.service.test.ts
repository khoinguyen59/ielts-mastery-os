import { describe, it, expect, beforeEach } from 'vitest';
import { placementService, LEVEL_PRESETS } from '../../src/services/placement.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

describe('PlacementService Unit Tests', () => {
  const db = getDatabase();

  beforeEach(() => {
    db.prepare('DELETE FROM user_stats WHERE user_id LIKE ?').run('user_diag_%');
    db.prepare('DELETE FROM user_stats WHERE user_id LIKE ?').run('user_empty_%');
  });

  it('provides all 4 LEVEL_PRESETS with recommended_daily metrics', () => {
    const presets = placementService.getLevelPresets();
    const keys = Object.keys(presets);
    expect(keys).toContain('foundation');
    expect(keys).toContain('intermediate');
    expect(keys).toContain('advanced');
    expect(keys).toContain('mastery');

    for (const key of keys as (keyof typeof LEVEL_PRESETS)[]) {
      expect(presets[key].recommended_daily).toBeGreaterThanOrEqual(8);
      expect(presets[key].starting_vocab_score).toBeGreaterThanOrEqual(1.0);
      expect(presets[key].band).toBeDefined();
    }
  });

  it('generates an adaptive 8-question diagnostic test spanning 4 tiers', () => {
    const questions = placementService.generateDiagnosticTest(8);
    expect(questions).toHaveLength(8);

    for (const q of questions) {
      expect(q.id).toMatch(/^diag_\d+_\d+$/);
      expect(q.options).toHaveLength(4);
      expect(q.correct_index).toBeGreaterThanOrEqual(0);
      expect(q.correct_index).toBeLessThanOrEqual(3);
      expect(q.target_band).toBeDefined();
      expect(q.explanation).toBeDefined();
    }
  });

  it('evaluates test results accurately and upserts user_stats', () => {
    const testQuestions = placementService.generateDiagnosticTest(8);
    const answers: Record<string, number> = {};

    // Answer first 6 correctly (75% accuracy -> Advanced level)
    for (let i = 0; i < testQuestions.length; i++) {
      answers[testQuestions[i].id] = i < 6 ? testQuestions[i].correct_index : (testQuestions[i].correct_index + 1) % 4;
    }

    const testUser = 'user_diag_test_1';
    const result = placementService.evaluateTest(answers, testUser);

    expect(result.total_questions).toBe(8);
    expect(result.correct_answers).toBe(6);
    expect(result.accuracy).toBe(0.75);
    expect(result.assigned_level_key).toBe('advanced');
    expect(result.estimated_band).toBe('7.0 - 7.5');

    // Verify user_stats row created
    const userRow = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(testUser) as any;
    expect(userRow).toBeDefined();
    expect(userRow.starting_band).toBe('7.0 - 7.5');
    expect(userRow.xp).toBe(6 * 25);
  });

  it('handles empty answers gracefully without NaN accuracy', () => {
    const result = placementService.evaluateTest({}, 'user_empty_diag');
    expect(result.accuracy).toBe(0);
    expect(result.correct_answers).toBe(0);
    expect(['starter', 'foundation']).toContain(result.assigned_level_key);
  });
});
