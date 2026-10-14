import { FastifyInstance } from 'fastify';
import { synthesisService } from '../../services/synthesis.service.js';
import { fsrsService } from '../../services/fsrs.service.js';
import { questionBankService } from '../../services/question-bank.service.js';
import { getDatabase } from '../../db/sqlite.js';
import { z } from 'zod';

const SubmitAnswerSchema = z.object({
  question_id: z.string(),
  selected_index: z.number().int().min(0).max(3),
  target_word_id: z.string().optional(),
  user_id: z.string().default('default_user')
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
        prompt: q.masked_sentence || q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        error_tag: q.error_tag || '[LỖI-COLLOCATION-CLASH]',
        band_75_upgrade: q.band_75_upgrade || '',
        band_85_upgrade: q.band_85_upgrade || ''
      }))
    };
  });

  // Submit and grade answer
  app.post('/api/quiz/submit', async (request, reply) => {
    const parse = SubmitAnswerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: parse.error.flatten() });
    }

    const { question_id, selected_index, target_word_id, user_id } = parse.data;
    const db = getDatabase();

    const q = questionBankService.getQuestionById(question_id);
    if (!q) {
      return reply.status(404).send({ success: false, error: 'Question not found' });
    }

    const isCorrect = selected_index === q.correct_index;
    const explanation = q.explanation;
    const correctIdx = q.correct_index;
    const targetWord = q.target_word || '';
    const effectiveWordId = target_word_id || q.target_word_id;

    let newScore = 1.0;
    if (effectiveWordId) {
      const rating = isCorrect ? 3 : 1;
      const res = fsrsService.reviewWord(effectiveWordId, rating);
      newScore = res.newScore;
    }

    if (isCorrect) {
      db.prepare(`
        UPDATE user_stats
        SET xp = xp + 15, coins = coins + 2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(user_id);
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
        user_stats: stats
      }
    };
  });
}
