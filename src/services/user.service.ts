import { getDatabase } from '../db/sqlite.js';
import { UserProfile, UserStats } from '../types/auth.types.js';

export class UserService {
  private get db() { return getDatabase(); }

  async getUserStats(userId: string): Promise<UserStats | null> {
    const row = this.db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId) as any;
    if (!row) return null;
    return {
      user_id: row.user_id, target_band: row.target_band, starting_band: row.starting_band,
      streak_days: row.streak_days, coins: row.coins, hearts: row.hearts,
      trust_score: row.trust_score, daily_goal: row.daily_goal, xp: row.xp
    };
  }

  async updateUserStats(userId: string, partialStats: Partial<UserStats>): Promise<UserStats | null> {
    const existing = await this.getUserStats(userId);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO user_stats (user_id, target_band, starting_band, streak_days, coins, hearts, trust_score, daily_goal, xp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, partialStats.target_band || '7.5 - 8.5+', partialStats.starting_band || '6.0',
        partialStats.streak_days ?? 1, partialStats.coins ?? 100, partialStats.hearts ?? 5,
        partialStats.trust_score ?? 1.0, partialStats.daily_goal ?? 10, partialStats.xp ?? 0
      );
    } else {
      const keys = Object.keys(partialStats).filter(k => k !== 'user_id');
      if (keys.length > 0) {
        const setClauses = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => (partialStats as any)[k]);
        this.db.prepare(`UPDATE user_stats SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(...values, userId);
      }
    }
    return this.getUserStats(userId);
  }

  async recordLessonProgress(userId: string, unitId: string, nodeIndex: number): Promise<boolean> {
    const userExists = this.db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!userExists) {
      this.db.prepare(`
        INSERT OR IGNORE INTO users (id, username, display_name, target_band, is_guest)
        VALUES (?, ?, ?, '7.5 - 8.5+', 1)
      `).run(userId, userId, userId);
    }
    const id = `prog_${userId}_${unitId}_${nodeIndex}`;
    this.db.prepare(`
      INSERT INTO user_lesson_progress (id, user_id, unit_id, node_index, status, completed_at)
      VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, unit_id, node_index) DO UPDATE SET completed_at = CURRENT_TIMESTAMP
    `).run(id, userId, unitId, nodeIndex);
    return true;
  }

  async getUserLessonProgress(userId: string, unitId?: string): Promise<any[]> {
    if (unitId) {
      return this.db.prepare('SELECT * FROM user_lesson_progress WHERE user_id = ? AND unit_id = ? ORDER BY node_index ASC').all(userId, unitId) as any[];
    }
    return this.db.prepare('SELECT * FROM user_lesson_progress WHERE user_id = ? ORDER BY unit_id ASC, node_index ASC').all(userId) as any[];
  }

  async deductHeart(userId: string = 'default_user'): Promise<{ success: boolean; hearts: number; is_exhausted: boolean }> {
    const stats = await this.getUserStats(userId);
    const currentHearts = stats?.hearts ?? 5;
    const newHearts = Math.max(0, currentHearts - 1);
    await this.updateUserStats(userId, { hearts: newHearts });
    return { success: true, hearts: newHearts, is_exhausted: newHearts === 0 };
  }

  async refillHearts(userId: string = 'default_user', refillType: 'coins' | 'practice' = 'coins'): Promise<{ success: boolean; hearts: number; coins: number; error?: string }> {
    const stats = await this.getUserStats(userId);
    const currentCoins = stats?.coins ?? 100;
    const currentHearts = stats?.hearts ?? 0;
    if (refillType === 'coins') {
      if (currentCoins < 50) return { success: false, hearts: currentHearts, coins: currentCoins, error: 'Insufficient coins' };
      const newCoins = currentCoins - 50;
      await this.updateUserStats(userId, { coins: newCoins, hearts: 5 });
      return { success: true, hearts: 5, coins: newCoins };
    }
    const newHearts = Math.min(5, currentHearts + 1);
    await this.updateUserStats(userId, { hearts: newHearts });
    return { success: true, hearts: newHearts, coins: currentCoins };
  }

  async completeLessonNode(userId: string = 'default_user', unitId: string = 'unit_01', nodeIndex: number): Promise<{ success: boolean; unlocked_node: number; completed_nodes: number[] }> {
    await this.recordLessonProgress(userId, unitId, nodeIndex);
    const rows = await this.getUserLessonProgress(userId, unitId);
    const completed = Array.from(new Set(rows.map(r => Number(r.node_index))));
    const unlockedNode = Math.min(5, (completed.length > 0 ? Math.max(...completed) : 0) + 1);
    return { success: true, unlocked_node: unlockedNode, completed_nodes: completed };
  }

  async getNodeProgression(userId: string = 'default_user', unitId: string = 'unit_01'): Promise<{ unit_id: string; unlocked_node: number; completed_nodes: number[] }> {
    const rows = await this.getUserLessonProgress(userId, unitId);
    const completed = Array.from(new Set(rows.map(r => Number(r.node_index))));
    const unlockedNode = Math.min(5, Math.max(1, (completed.length > 0 ? Math.max(...completed) : 0) + 1));
    return { unit_id: unitId, unlocked_node: unlockedNode, completed_nodes: completed };
  }

  async updateProfile(userId: string, updates: { display_name?: string; avatar?: string; target_band?: string; starting_band?: string; onboarding_completed?: boolean }): Promise<UserProfile | null> {
    const userRow = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!userRow) return null;
    const userKeys = Object.keys(updates).filter(k => ['display_name', 'avatar', 'target_band', 'starting_band', 'onboarding_completed'].includes(k));
    if (userKeys.length > 0) {
      const setClauses = userKeys.map(k => `${k} = ?`).join(', ');
      const values = userKeys.map(k => k === 'onboarding_completed' ? (updates[k] ? 1 : 0) : (updates as any)[k]);
      this.db.prepare(`UPDATE users SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, userId);
    }
    if (updates.target_band || updates.starting_band) {
      await this.updateUserStats(userId, { target_band: updates.target_band, starting_band: updates.starting_band });
    }
    const updatedUser = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const stats = await this.getUserStats(userId);
    return {
      id: updatedUser.id, username: updatedUser.username, display_name: updatedUser.display_name, avatar: updatedUser.avatar,
      target_band: stats?.target_band || updatedUser.target_band, starting_band: stats?.starting_band || updatedUser.starting_band,
      is_guest: Boolean(updatedUser.is_guest), onboarding_completed: Boolean(updatedUser.onboarding_completed),
      hearts: stats?.hearts ?? 5, coins: stats?.coins ?? 100, streak_days: stats?.streak_days ?? 1, xp: stats?.xp ?? 0,
      created_at: updatedUser.created_at
    };
  }
}

export const userService = new UserService();
export default userService;
