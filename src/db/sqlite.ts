import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseType | null = null;

export function getDatabase(dbPath?: string): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const resolvedPath = dbPath || path.resolve(process.cwd(), 'data', 'ielts_mastery.db');
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  // Initialize schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

  // Ensure default user stats row exists
  const existingUser = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').get('default_user');
  if (!existingUser) {
    db.prepare(`
      INSERT INTO user_stats (user_id, target_band, starting_band, streak_days, coins, hearts, trust_score, daily_goal, xp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('default_user', '7.5 - 8.5+', '6.0', 1, 100, 5, 1.0, 10, 0);
  }

  dbInstance = db;
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
