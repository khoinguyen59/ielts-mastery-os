import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';
import { AuthResult, LoginInput, RegisterInput, UserProfile } from '../types/auth.types.js';

export class AuthService {
  private get db() {
    const database = getDatabase();
    this.ensureSchema(database);
    return database;
  }

  private ensureSchema(db: ReturnType<typeof getDatabase>): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT, salt TEXT, display_name TEXT, avatar TEXT DEFAULT 'cabi_academic', target_band TEXT DEFAULT '7.5 - 8.5+', starting_band TEXT DEFAULT '6.0', is_guest INTEGER DEFAULT 0, onboarding_completed INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME);
      CREATE TABLE IF NOT EXISTS user_lesson_progress (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, unit_id TEXT NOT NULL, node_index INTEGER NOT NULL, status TEXT DEFAULT 'completed', completed_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, unit_id, node_index));
    `);
  }

  private mapUser(userRow: any, statsRow?: any): UserProfile {
    return {
      id: userRow.id,
      username: userRow.username,
      display_name: userRow.display_name || userRow.username,
      avatar: userRow.avatar || 'cabi_academic',
      target_band: statsRow?.target_band || userRow.target_band || '7.5 - 8.5+',
      starting_band: statsRow?.starting_band || userRow.starting_band || '6.0',
      is_guest: Boolean(userRow.is_guest),
      onboarding_completed: Boolean(userRow.onboarding_completed),
      hearts: statsRow?.hearts ?? 5,
      coins: statsRow?.coins ?? 100,
      streak_days: statsRow?.streak_days ?? 1,
      xp: statsRow?.xp ?? 0,
      created_at: userRow.created_at
    };
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    if (!input.username || !input.password) throw new Error('Username and password are required');
    const existing = this.db.prepare('SELECT id FROM users WHERE username = ?').get(input.username);
    if (existing) throw new Error(`Username ${input.username} already exists`);

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(input.password, salt, 10000, 64, 'sha512').toString('hex');
    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const displayName = input.display_name || input.username;
    const targetBand = input.target_band || '7.5 - 8.5+';

    this.db.prepare(`
      INSERT INTO users (id, username, password_hash, salt, display_name, target_band, is_guest)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(userId, input.username, hash, salt, displayName, targetBand);

    this.db.prepare(`
      INSERT OR REPLACE INTO user_stats (user_id, target_band, starting_band, coins, hearts, streak_days, xp)
      VALUES (?, ?, '6.0', 100, 5, 1, 0)
    `).run(userId, targetBand);

    const token = crypto.randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO user_sessions (id, user_id, token) VALUES (?, ?, ?)')
      .run(`sess_${Date.now()}`, userId, token);

    const user = this.getUserByIdSync(userId);
    return { success: true, token, user: user! };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const userRow = this.db.prepare('SELECT * FROM users WHERE username = ?').get(input.username) as any;
    if (!userRow || !userRow.salt || !userRow.password_hash) throw new Error('Invalid username or password');

    const hash = crypto.pbkdf2Sync(input.password, userRow.salt, 10000, 64, 'sha512').toString('hex');
    if (hash !== userRow.password_hash) throw new Error('Invalid username or password');

    const token = crypto.randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO user_sessions (id, user_id, token) VALUES (?, ?, ?)')
      .run(`sess_${Date.now()}`, userRow.id, token);

    const user = this.getUserByIdSync(userRow.id);
    return { success: true, token, user: user! };
  }

  async createGuestProfile(): Promise<AuthResult> {
    const guestId = `guest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const guestUsername = `guest_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
    const displayName = 'Khách Học Viên';

    this.db.prepare(`
      INSERT INTO users (id, username, display_name, is_guest)
      VALUES (?, ?, ?, 1)
    `).run(guestId, guestUsername, displayName);

    this.db.prepare(`
      INSERT OR REPLACE INTO user_stats (user_id, target_band, starting_band, coins, hearts, streak_days, xp)
      VALUES (?, '7.5 - 8.5+', '6.0', 100, 5, 1, 0)
    `).run(guestId);

    const token = crypto.randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO user_sessions (id, user_id, token) VALUES (?, ?, ?)')
      .run(`sess_${Date.now()}`, guestId, token);

    const user = this.getUserByIdSync(guestId);
    return { success: true, token, user: user!, is_guest: true };
  }

  guest = this.createGuestProfile.bind(this);

  async listProfiles(): Promise<UserProfile[]> {
    const rows = this.db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.is_guest, u.onboarding_completed, u.created_at,
             s.target_band, s.starting_band, s.hearts, s.coins, s.streak_days, s.xp
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      ORDER BY u.created_at DESC
    `).all() as any[];

    return rows.map(r => this.mapUser(r, r));
  }

  async switchProfile(userId: string): Promise<AuthResult> {
    const user = this.getUserByIdSync(userId);
    if (!user) throw new Error('User not found');

    const token = crypto.randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO user_sessions (id, user_id, token) VALUES (?, ?, ?)')
      .run(`sess_${Date.now()}`, userId, token);

    this.db.prepare("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
    return { success: true, token, user };
  }

  async verifySession(token: string): Promise<UserProfile | null> {
    const sess = this.db.prepare('SELECT user_id FROM user_sessions WHERE token = ?').get(token) as any;
    if (!sess) return null;
    return this.getUserByIdSync(sess.user_id);
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    return this.getUserByIdSync(userId);
  }

  private getUserByIdSync(userId: string): UserProfile | null {
    const userRow = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!userRow) return null;
    const statsRow = this.db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId) as any;
    return this.mapUser(userRow, statsRow);
  }

  async mergeGuestData(userId: string, data: {
    scores?: Record<string, { score: number } | number>;
    streak?: { current?: number; best?: number; totalPracticed?: number };
    coins?: number;
    hearts?: number;
    xp?: number;
  }): Promise<{ success: boolean; mergedCount: number }> {
    if (!userId) throw new Error('userId is required');
    let mergedCount = 0;

    if (data.scores && typeof data.scores === 'object') {
      const stmt = this.db.prepare(`
        INSERT INTO user_vocab_progress (user_id, word_id, current_score, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, word_id) DO UPDATE SET
          current_score = MAX(user_vocab_progress.current_score, excluded.current_score),
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const [wordId, val] of Object.entries(data.scores)) {
        const score = typeof val === 'number' ? val : (val && typeof val === 'object' ? (val as any).score : 1.0);
        if (wordId && typeof score === 'number' && !isNaN(score)) {
          try {
            stmt.run(userId, wordId, score);
            mergedCount++;
          } catch {}
        }
      }
    }

    const existingStats = this.db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId) as any;
    const currentCoins = existingStats?.coins ?? 100;
    const currentStreak = existingStats?.streak_days ?? 1;
    const currentXp = existingStats?.xp ?? 0;

    const newCoins = Math.max(currentCoins, data.coins ?? 0);
    const newStreak = Math.max(currentStreak, data.streak?.current ?? 0);
    const newXp = Math.max(currentXp, data.xp ?? 0);

    this.db.prepare(`
      UPDATE user_stats 
      SET coins = ?, streak_days = ?, xp = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newCoins, newStreak, newXp, userId);

    return { success: true, mergedCount };
  }
}

export const authService = new AuthService();
export default authService;
