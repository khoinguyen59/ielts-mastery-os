import { describe, it, expect, beforeEach } from 'vitest';
import { userService } from '../../src/services/user.service.js';
import { getDatabase } from '../../src/db/sqlite.js';

describe('UserService Progression & Energy Tests', () => {
  const testUserId = `test_user_${Date.now()}`;

  beforeEach(() => {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, display_name, target_band, is_guest)
      VALUES (?, ?, ?, '7.5 - 8.5+', 1)
    `).run(testUserId, testUserId, 'Test Runner');

    db.prepare(`
      INSERT OR REPLACE INTO user_stats (user_id, target_band, starting_band, streak_days, coins, hearts, trust_score, daily_goal, xp)
      VALUES (?, '7.5 - 8.5+', '6.0', 1, 100, 5, 1.0, 10, 0)
    `).run(testUserId);
  });

  it('fetches and updates user stats accurately', async () => {
    const stats = await userService.getUserStats(testUserId);
    expect(stats).toBeDefined();
    expect(stats?.hearts).toBe(5);
    expect(stats?.coins).toBe(100);

    const updated = await userService.updateUserStats(testUserId, { coins: 150 });
    expect(updated?.coins).toBe(150);
  });

  it('deducts hearts and detects exhaustion', async () => {
    const d1 = await userService.deductHeart(testUserId);
    expect(d1.success).toBe(true);
    expect(d1.hearts).toBe(4);
    expect(d1.is_exhausted).toBe(false);

    await userService.updateUserStats(testUserId, { hearts: 1 });
    const dLast = await userService.deductHeart(testUserId);
    expect(dLast.hearts).toBe(0);
    expect(dLast.is_exhausted).toBe(true);
  });

  it('refills hearts via practice and coins', async () => {
    await userService.updateUserStats(testUserId, { hearts: 0, coins: 100 });

    const refillCoins = await userService.refillHearts(testUserId, 'coins');
    expect(refillCoins.success).toBe(true);
    expect(refillCoins.hearts).toBe(5);
    expect(refillCoins.coins).toBe(50);

    await userService.updateUserStats(testUserId, { hearts: 2 });
    const refillPractice = await userService.refillHearts(testUserId, 'practice');
    expect(refillPractice.success).toBe(true);
    expect(refillPractice.hearts).toBe(3);
  });

  it('records lesson node progression sequentially', async () => {
    const res1 = await userService.completeLessonNode(testUserId, 'unit_test', 1);
    expect(res1.success).toBe(true);
    expect(res1.unlocked_node).toBe(2);

    const prog = await userService.getNodeProgression(testUserId, 'unit_test');
    expect(prog.completed_nodes).toContain(1);
    expect(prog.unlocked_node).toBe(2);
  });
});
