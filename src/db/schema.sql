-- IELTS Mastery OS SQLite Schema
-- Compliant with Invariant 05 (< 200 lines) and Invariant 07 (Zero Mockup)

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  pos TEXT NOT NULL,
  ipa TEXT,
  meaning TEXT NOT NULL,
  synonyms TEXT DEFAULT '[]',
  antonyms TEXT DEFAULT '[]',
  collocations TEXT DEFAULT '[]',
  example TEXT,
  lego_roots TEXT DEFAULT '{}',
  nuance TEXT,
  derivatives TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS user_vocab_progress (
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

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  target_word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  embedded_word_ids TEXT DEFAULT '[]',
  prompt TEXT NOT NULL,
  masked_sentence TEXT,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  error_tag TEXT,
  band_75_upgrade TEXT,
  band_85_upgrade TEXT,
  status TEXT DEFAULT 'active',
  quality_tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_submissions (
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

CREATE TABLE IF NOT EXISTS user_stats (
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

CREATE TABLE IF NOT EXISTS question_feedback_logs (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  review_stage TEXT DEFAULT 'pending_v1',
  reward_coins INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  node_index INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, unit_id, node_index)
);

CREATE TABLE IF NOT EXISTS confused_word_pairs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  confused_word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, target_word_id, confused_word_id)
);

-- Optimized Performance Indexes
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_questions_target ON questions(target_word_id, status);
CREATE INDEX IF NOT EXISTS idx_progress_due ON user_vocab_progress(due_date);
CREATE INDEX IF NOT EXISTS idx_progress_score ON user_vocab_progress(current_score);
CREATE INDEX IF NOT EXISTS idx_vocab_progress_user ON user_vocab_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_question ON question_feedback_logs(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_passage ON exam_submissions(passage_id);
CREATE INDEX IF NOT EXISTS idx_exam_sub_user ON exam_submissions(user_id, passage_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress ON user_lesson_progress(user_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_confused_user_target ON confused_word_pairs(user_id, target_word_id);

