import { fsrs, Card, State, createEmptyCard, RecordLogItem } from 'ts-fsrs';
import { getDatabase } from '../db/sqlite.js';
import { FSRSProgress } from '../types/vocab.types.js';
import { markdownSyncService } from './markdown-sync.service.js';

export class FSRSService {
  private db = getDatabase();
  private f = fsrs();

  public getCard(wordId: string): FSRSProgress {
    let row = this.db.prepare(`
      SELECT * FROM user_vocab_progress WHERE word_id = ?
    `).get(wordId) as any;

    if (!row) {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO user_vocab_progress (word_id, stability, difficulty, reps, lapses, state, due_date, current_score)
        VALUES (?, 0.0, 0.0, 0, 0, 0, ?, 1.0)
      `).run(wordId, now);

      row = {
        word_id: wordId,
        stability: 0.0,
        difficulty: 0.0,
        reps: 0,
        lapses: 0,
        state: 0,
        due_date: now,
        last_review: null,
        current_score: 1.0
      };
    }

    return row as FSRSProgress;
  }

  public reviewWord(
    wordId: string,
    rating: 1 | 2 | 3 | 4,
    reviewDate: Date = new Date()
  ): { progress: FSRSProgress; newScore: number } {
    const current = this.getCard(wordId);
    
    // Construct Card instance using createEmptyCard as base
    const baseCard = createEmptyCard(reviewDate);
    const card: Card = {
      ...baseCard,
      due: current.due_date ? new Date(current.due_date) : reviewDate,
      stability: current.stability || 0,
      difficulty: current.difficulty || 0,
      elapsed_days: current.last_review ? Math.max(0, (reviewDate.getTime() - new Date(current.last_review).getTime()) / 86400000) : 0,
      scheduled_days: 0,
      reps: current.reps || 0,
      lapses: current.lapses || 0,
      state: (current.state as State) || State.New,
      last_review: current.last_review ? new Date(current.last_review) : undefined
    };

    const scheduled = this.f.repeat(card, reviewDate);
    const resultRecord = scheduled[rating as 1 | 2 | 3 | 4] as RecordLogItem;
    const updatedCard = resultRecord.card;

    // Calculate score on 1.0 - 7.0 scale
    let newScore = current.current_score;
    let finalLapses = updatedCard.lapses;
    let finalReps = updatedCard.reps;

    if (rating === 1) {
      // Lapse: reset or lower score, record lapse
      newScore = Math.max(1.0, Number((newScore * 0.5).toFixed(2)));
      finalLapses = current.lapses + 1;
      finalReps = 0;
    } else if (rating === 2) {
      // Hard: slight progression
      newScore = Math.min(6.0, Number((newScore + 0.35).toFixed(2)));
    } else if (rating === 3) {
      // Good: solid progression (+1.0)
      newScore = Math.min(6.5, Number((newScore + 1.0).toFixed(2)));
    } else if (rating === 4) {
      // Easy: rapid mastery
      newScore = Math.min(7.0, Number((newScore + 1.75).toFixed(2)));
    }

    // Save to SQLite
    this.db.prepare(`
      UPDATE user_vocab_progress
      SET stability = ?, difficulty = ?, reps = ?, lapses = ?, state = ?, due_date = ?, last_review = ?, current_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE word_id = ?
    `).run(
      updatedCard.stability,
      updatedCard.difficulty,
      finalReps,
      finalLapses,
      updatedCard.state,
      updatedCard.due.toISOString(),
      reviewDate.toISOString(),
      newScore,
      wordId
    );

    // Fetch word text for silent markdown sync (Invariant 18)
    const wordRow = this.db.prepare('SELECT word FROM words WHERE id = ?').get(wordId) as { word: string } | undefined;
    if (wordRow) {
      try {
        markdownSyncService.updateWordScore(wordRow.word, newScore);
      } catch (err) {
        // Silent failure - do not break learning session
      }
    }

    const updatedProgress: FSRSProgress = {
      word_id: wordId,
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      reps: finalReps,
      lapses: finalLapses,
      state: updatedCard.state,
      due_date: updatedCard.due.toISOString(),
      last_review: reviewDate.toISOString(),
      current_score: newScore
    };

    return { progress: updatedProgress, newScore };
  }

  public getLearnedWordIds(minScore: number = 2.0): string[] {
    const rows = this.db.prepare(`
      SELECT word_id FROM user_vocab_progress WHERE current_score >= ?
    `).all(minScore) as { word_id: string }[];
    return rows.map(r => r.word_id);
  }
}

export const fsrsService = new FSRSService();
