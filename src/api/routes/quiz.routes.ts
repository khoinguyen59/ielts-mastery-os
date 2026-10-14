import { FastifyInstance } from 'fastify';
import { synthesisService } from '../../services/synthesis.service.js';
import { fsrsService } from '../../services/fsrs.service.js';
import { questionBankService } from '../../services/question-bank.service.js';
import { expansionService } from '../../services/expansion.service.js';
import { markdownSyncService } from '../../services/markdown-sync.service.js';
import { getDatabase } from '../../db/sqlite.js';
import { z } from 'zod';

const SubmitAnswerSchema = z.object({
  question_id: z.string(),
  selected_index: z.number().int().min(0).max(3),
  target_word_id: z.string().optional(),
  user_id: z.string().default('default_user'),
  response_time_ms: z.number().optional(),
  time_left_seconds: z.number().optional()
});

export async function quizRoutes(app: FastifyInstance) {
  // Generate 80/20 Recursive Synthesis round
  app.get('/api/quiz/synthesis', async (request) => {
    const query = request.query as { target_word_id?: string; count?: string; user_id?: string; level?: string };
    const count = query.count ? parseInt(query.count) : 5;
    const userId = query.user_id || (request.headers['x-user-id'] as string) || 'default_user';
    const level = query.level || 'intermediate';
    const questions = synthesisService.getSynthesisRound(query.target_word_id, count, userId, level);
    return { success: true, count: questions.length, data: questions };
  });

  // Alias for UI: GET /api/practice/quiz
  app.get('/api/practice/quiz', async (request) => {
    const query = request.query as { count?: string; user_id?: string; level?: string };
    const count = query.count ? parseInt(query.count) : 10;
    const userId = query.user_id || (request.headers['x-user-id'] as string) || 'default_user';
    const level = query.level || 'intermediate';
    const questions = synthesisService.getSynthesisRound(undefined, count, userId, level);
    return {
      round_id: `round_${Date.now()}`,
      count: questions.length,
      level,
      questions: questions.map((q) => ({
        id: q.id,
        target_word: q.target_word || '',
        word_id: q.target_word_id,
        badge: 'Điền từ học thuật',
        morph_badge: q.badge,
        chain_id: q.chain_id,
        chain_step: q.chain_step,
        chain_badge: q.chain_badge,
        morph_stage: q.morph_stage,
        prompt: q.masked_sentence || q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        error_tag: q.error_tag || '[LỖI-COLLOCATION-CLASH]',
        band_75_upgrade: q.band_75_upgrade || '',
        band_85_upgrade: q.band_85_upgrade || '',
        embedded_word_ids: q.embedded_word_ids || [],
        word_details: q.word_details
      }))
    };
  });

  // Submit and grade answer with Ripple FSRS Bonus & Confused Pair Tracking
  app.post('/api/quiz/submit', async (request, reply) => {
    const parse = SubmitAnswerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: parse.error.flatten() });
    }

    const { question_id, selected_index, target_word_id, user_id, response_time_ms, time_left_seconds } = parse.data;
    const db = getDatabase();

    const q = questionBankService.getQuestionById(question_id);
    if (!q) {
      return reply.status(404).send({ success: false, error: 'Question not found' });
    }

    const isCorrect = selected_index === q.correct_index;
    const explanation = q.explanation;
    const correctIdx = q.correct_index;
    const effectiveWordId = target_word_id || q.target_word_id;
    let targetWord = q.target_word || '';
    if (!targetWord && effectiveWordId) {
      const wRow = db.prepare('SELECT word FROM words WHERE id = ?').get(effectiveWordId) as { word: string } | undefined;
      if (wRow) targetWord = wRow.word;
    }

    let newScore = 1.0;
    if (effectiveWordId) {
      const rating = isCorrect ? 3 : 1;
      const res = fsrsService.reviewWord(effectiveWordId, rating, new Date(), user_id);
      newScore = res.newScore;
    }

    const rippleBonusWords: Array<{ word_id: string; bonus: number }> = [];

    if (isCorrect) {
      db.prepare(`
        UPDATE user_stats
        SET xp = xp + 15, coins = coins + 2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(user_id);

      // Requirement 5: Ripple FSRS bonus for embedded_word_ids if answered fast (< 6s)
      const isFast = response_time_ms !== undefined ? response_time_ms < 6000 : (time_left_seconds !== undefined ? time_left_seconds >= 4 : true);
      if (isFast && q.embedded_word_ids && q.embedded_word_ids.length > 0) {
        for (const embId of q.embedded_word_ids) {
          try {
            db.prepare(`
              UPDATE user_vocab_progress
              SET current_score = MIN(7.0, current_score + 0.15),
                  stability = stability + 0.1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE word_id = ? AND user_id = ?
            `).run(embId, user_id);

            rippleBonusWords.push({ word_id: embId, bonus: 0.15 });

            if (user_id === 'default_user') {
              const embRow = db.prepare(`
                SELECT w.word, p.current_score
                FROM words w
                JOIN user_vocab_progress p ON w.id = p.word_id
                WHERE w.id = ? AND p.user_id = ?
              `).get(embId, user_id) as { word: string; current_score: number } | undefined;
              if (embRow) {
                markdownSyncService.updateWordScore(embRow.word, embRow.current_score);
              }
            }
          } catch {}
        }
      }
    } else {
      // Requirement 5: Confused Pair Tracking when answering wrong with a distractor
      const chosenWordText = (q.options[selected_index] || '').trim();
      if (chosenWordText && effectiveWordId) {
        const distractorRow = db.prepare('SELECT id, word FROM words WHERE LOWER(word) = LOWER(?)').get(chosenWordText) as { id: string; word: string } | undefined;
        if (distractorRow && distractorRow.id !== effectiveWordId) {
          expansionService.recordConfusedPair(user_id, effectiveWordId, distractorRow.id);

          // Mark distractor in user_vocab_progress to penalize or flag as weak word
          try {
            const prog = db.prepare('SELECT word_id FROM user_vocab_progress WHERE word_id = ? AND user_id = ?').get(distractorRow.id, user_id);
            if (prog) {
              db.prepare(`
                UPDATE user_vocab_progress
                SET lapses = lapses + 1, current_score = MAX(1.0, current_score - 0.2), updated_at = CURRENT_TIMESTAMP
                WHERE word_id = ? AND user_id = ?
              `).run(distractorRow.id, user_id);
            } else {
              db.prepare(`
                INSERT INTO user_vocab_progress (user_id, word_id, stability, difficulty, reps, lapses, state, current_score, updated_at)
                VALUES (?, ?, 0.0, 0.0, 0, 1, 0, 1.0, CURRENT_TIMESTAMP)
              `).run(user_id, distractorRow.id);
            }
          } catch {}
        }
      }
    }

    const stats = db.prepare('SELECT coins, hearts, xp, streak_days FROM user_stats WHERE user_id = ?').get(user_id);

    return {
      success: true,
      data: {
        is_correct: isCorrect,
        correct_index: correctIdx,
        explanation,
        target_word: targetWord,
        new_vocab_score: newScore,
        ripple_bonus_words: rippleBonusWords,
        user_stats: stats
      }
    };
  });
}
