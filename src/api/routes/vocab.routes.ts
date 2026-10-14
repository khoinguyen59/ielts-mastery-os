import { FastifyInstance } from 'fastify';
import { vocabService } from '../../services/vocab.service.js';
import { fsrsService } from '../../services/fsrs.service.js';
import { markdownSyncService } from '../../services/markdown-sync.service.js';
import { getDatabase, ensureUserExists } from '../../db/sqlite.js';
import { z } from 'zod';

const ReviewBodySchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  user_id: z.string().optional()
});

const UpdateScoreSchema = z.object({
  id: z.string(),
  score: z.number().min(1.0).max(7.0),
  user_id: z.string().optional()
});

export async function vocabRoutes(app: FastifyInstance) {
  // Get all or search words
  app.get('/api/vocab', async (request) => {
    const query = request.query as { q?: string; pos?: string; limit?: string; user_id?: string };
    const userId = query.user_id || 'default_user';
    if (query.q) {
      const results = vocabService.search(query.q, query.pos, query.limit ? parseInt(query.limit) : 50, userId);
      return { success: true, count: results.length, data: results };
    }
    const all = vocabService.getAll(userId);
    return { success: true, count: all.length, data: all };
  });

  // Get vocabulary partitioned by course level/tier
  app.get('/api/vocab/tier', async (request) => {
    const query = request.query as { level?: string; user_id?: string };
    const levelKey = query.level || 'intermediate';
    const userId = query.user_id || 'default_user';
    const words = vocabService.getByLevel(levelKey, userId);
    return { success: true, level: levelKey, count: words.length, data: words };
  });

  // Get words due for FSRS review
  app.get('/api/vocab/due', async (request) => {
    const query = request.query as { limit?: string; user_id?: string };
    const limit = query.limit ? parseInt(query.limit) : 20;
    const userId = query.user_id || 'default_user';
    const due = vocabService.getDueWords(limit, userId);
    return { success: true, count: due.length, data: due };
  });

  // Get specific word by ID
  app.get('/api/vocab/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { user_id?: string };
    const userId = query.user_id || 'default_user';
    const word = vocabService.getById(id, userId);
    if (!word) {
      return reply.status(404).send({ success: false, error: 'Word not found' });
    }
    const fsrsData = fsrsService.getCard(word.id, userId);
    return { success: true, data: { ...word, fsrs: fsrsData } };
  });

  // Submit FSRS review for word
  app.post('/api/vocab/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { user_id?: string };
    const body = (request.body || {}) as Record<string, any>;
    const userId = query.user_id || body.user_id || 'default_user';

    const parseRes = ReviewBodySchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ success: false, error: parseRes.error.flatten() });
    }

    const word = vocabService.getById(id, userId);
    if (!word) {
      return reply.status(404).send({ success: false, error: 'Word not found' });
    }

    const { progress, newScore } = fsrsService.reviewWord(word.id, parseRes.data.rating, new Date(), userId);
    return {
      success: true,
      data: {
        word_id: word.id,
        word: word.word,
        new_score: newScore,
        progress
      }
    };
  });

  // Direct score update for local_store.js sync and manual adjustments
  app.post('/api/vocab/update-score', async (request, reply) => {
    const parse = UpdateScoreSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: parse.error.flatten() });
    }

    const query = request.query as { user_id?: string };
    const { id, score, user_id } = parse.data;
    const userId = user_id || query.user_id || 'default_user';

    const word = vocabService.getById(id, userId);
    if (!word) {
      return reply.status(404).send({ success: false, error: 'Word not found' });
    }

    const db = getDatabase();
    ensureUserExists(userId, db);

    db.prepare(`
      INSERT INTO user_vocab_progress (user_id, word_id, current_score, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        current_score = excluded.current_score,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, word.id, score);

    if (userId === 'default_user') {
      try {
        markdownSyncService.updateWordScore(word.word, score);
      } catch {
        // Non-blocking silent sync
      }
    }

    return { success: true, word_id: word.id, new_score: score };
  });
}
