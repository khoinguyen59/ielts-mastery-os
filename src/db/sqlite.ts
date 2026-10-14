import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseType | null = null;

export function ensureUserExists(userId: string = 'default_user', db?: DatabaseType): void {
  const targetDb = db || dbInstance || getDatabase();
  if (!targetDb) return;
  targetDb.prepare(`
    INSERT OR IGNORE INTO users (id, username, display_name, is_guest)
    VALUES (?, ?, ?, 1)
  `).run(userId, userId, userId);
}

function runLiveMigrations(db: DatabaseType): void {
  // Drop any legacy triggers that reference columns before migration
  db.exec(`
    DROP TRIGGER IF EXISTS trg_ensure_user_stats_user;
    DROP TRIGGER IF EXISTS trg_ensure_vocab_user;
    DROP TRIGGER IF EXISTS trg_ensure_exam_user;
  `);

  // 0. Ensure users table exists so foreign keys and migrations can succeed
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      salt TEXT,
      display_name TEXT,
      avatar TEXT DEFAULT 'cabi_academic',
      target_band TEXT DEFAULT '7.5 - 8.5+',
      starting_band TEXT DEFAULT '6.0',
      is_guest INTEGER DEFAULT 0,
      onboarding_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default_user exists in users before migration copying
  ensureUserExists('default_user', db);

  // 1. Migrate user_vocab_progress to add user_id with composite primary key
  const vocabCols = db.pragma('table_info(user_vocab_progress)') as Array<{ name: string }>;
  if (vocabCols.length > 0 && !vocabCols.some(c => c.name === 'user_id')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_vocab_progress_m2 (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        stability REAL DEFAULT 0.0,
        difficulty REAL DEFAULT 0.0,
        reps INTEGER DEFAULT 0,
        lapses INTEGER DEFAULT 0,
        state INTEGER DEFAULT 0,
        due_date TEXT,
        last_review TEXT,
        current_score REAL DEFAULT 1.0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, word_id)
      );
      INSERT OR IGNORE INTO user_vocab_progress_m2 (
        user_id, word_id, stability, difficulty, reps, lapses, state, due_date, last_review, current_score, updated_at
      )
      SELECT 'default_user', word_id, stability, difficulty, reps, lapses, state, due_date, last_review, current_score, updated_at
      FROM user_vocab_progress;
      DROP TABLE user_vocab_progress;
      ALTER TABLE user_vocab_progress_m2 RENAME TO user_vocab_progress;
    `);
  }

  // 2. Migrate exam_submissions to add user_id column
  const examCols = db.pragma('table_info(exam_submissions)') as Array<{ name: string }>;
  if (examCols.length > 0 && !examCols.some(c => c.name === 'user_id')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS exam_submissions_m2 (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        passage_id TEXT NOT NULL,
        submission_type TEXT NOT NULL,
        answers TEXT NOT NULL,
        score_ratio REAL DEFAULT 0.0,
        estimated_band TEXT,
        raw_score INTEGER DEFAULT 0,
        ai_feedback TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO exam_submissions_m2 (
        id, user_id, passage_id, submission_type, answers, score_ratio, estimated_band, raw_score, ai_feedback, created_at
      )
      SELECT id, 'default_user', passage_id, submission_type, answers, score_ratio, estimated_band, raw_score, ai_feedback, created_at
      FROM exam_submissions;
      DROP TABLE exam_submissions;
      ALTER TABLE exam_submissions_m2 RENAME TO exam_submissions;
    `);
  }

  // 3. Migrate user_stats to enforce foreign key ON DELETE CASCADE
  const statsCols = db.pragma('table_info(user_stats)') as Array<{ name: string }>;
  const statsFk = db.pragma('foreign_key_list(user_stats)') as Array<{ table: string; on_delete: string }>;
  if (statsCols.length > 0 && !statsFk.some(fk => fk.table === 'users' && fk.on_delete === 'CASCADE')) {
    db.exec(`
      INSERT OR IGNORE INTO users (id, username, display_name, is_guest)
      SELECT DISTINCT user_id, user_id, user_id, 1
      FROM user_stats;
    `);

    const existingColNames = statsCols.map(c => c.name);
    const standardCols = [
      'user_id', 'target_band', 'starting_band', 'streak_days',
      'last_active_date', 'coins', 'hearts', 'trust_score',
      'daily_goal', 'xp', 'created_at', 'updated_at'
    ];
    const colsToCopy = standardCols.filter(col => existingColNames.includes(col));
    const colListStr = colsToCopy.join(', ');

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_stats_m2 (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        target_band TEXT DEFAULT '7.5 - 8.5+',
        starting_band TEXT DEFAULT '6.0',
        streak_days INTEGER DEFAULT 1,
        last_active_date TEXT,
        coins INTEGER DEFAULT 100,
        hearts INTEGER DEFAULT 5,
        trust_score REAL DEFAULT 1.0,
        daily_goal INTEGER DEFAULT 10,
        xp INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO user_stats_m2 (${colListStr})
      SELECT ${colListStr} FROM user_stats;
      DROP TABLE user_stats;
      ALTER TABLE user_stats_m2 RENAME TO user_stats;
    `);
  }

  // 4. Ensure confused_word_pairs table exists for confused pair tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS confused_word_pairs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      confused_word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      count INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, target_word_id, confused_word_id)
    );
  `);
}

export function getDatabase(dbPath?: string): DatabaseType {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const resolvedPath = dbPath || path.resolve(process.cwd(), 'data', 'ielts_mastery.db');
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Execute idempotent live migrations before applying schema indexes/triggers
  runLiveMigrations(db);

  // Initialize schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

  // Enable foreign keys after migrations and schema setup
  db.pragma('foreign_keys = ON');

  // Ensure default user stats row exists
  const existingUser = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?').get('default_user');
  if (!existingUser) {
    db.prepare(`
      INSERT INTO user_stats (user_id, target_band, starting_band, streak_days, coins, hearts, trust_score, daily_goal, xp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('default_user', '7.5 - 8.5+', '6.0', 1, 100, 5, 1.0, 10, 0);
  }

  if (!dbPath) {
    dbInstance = db;
  }
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
