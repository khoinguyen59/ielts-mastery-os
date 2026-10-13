import { FastifyInstance } from 'fastify';
import { vocabService } from '../../services/vocab.service.js';
import { fsrsService } from '../../services/fsrs.service.js';
import { markdownSyncService } from '../../services/markdown-sync.service.js';
import { getDatabase } from '../../db/sqlite.js';
import { z } from 'zod';

const ReviewBodySchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
});

const UpdateScoreSchema = z.object({
  id: z.string(),
  score: z.number().min(1.0).max(7.0)
});

export async function vocabRoutes(app: FastifyInstance) {
  // Get all or search words
  app.get('/api/vocab', async (request, reply) => {
    const query = request.query as { q?: string; pos?: string; limit?: string };
    if (query.q) {
      const results = vocabService.search(query.q, query.pos, query.limit ? parseInt(query.limit) : 50);
      return { success: true, count: results.length, data: results };
    }
    const all = vocabService.getAll();
    return { success: true, count: all.length, data: all };
  });

  // Get vocabulary partitioned by course level/tier
  app.get('/api/vocab/tier', async (request) => {
    const query = request.query as { level?: string };
    const levelKey = query.level || 'intermediate';
    const words = vocabService.getByLevel(levelKey);
    return { success: true, level: levelKey, count: words.length, data: words };
  });

  // Get words due for FSRS review
  app.get('/api/vocab/due', async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit) : 20;
    const due = vocabService.getDueWords(limit);
    return { success: true, count: due.length, data: due };
  });

  // Get specific word by ID
  app.get('/api/vocab/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const word = vocabService.getById(id);
    if (!word) {
      return reply.status(404).send({ success: false, error: 'Word not found' });
    }
    const fsrsData = fsrsService.getCard(word.id);
    return { success: true, data: { ...word, fsrs: fsrsData } };
  });

  // Submit FSRS review for word
  app.post('/api/vocab/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseRes = ReviewBodySchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ success: false, error: parseRes.error.flatten() });
    }

    const word = vocabService.getById(id);
    if (!word) {
      return reply.status(404).send({ success: false, error: 'Word not found' });
    }

    const { progress, newScore } = fsrsService.reviewWord(word.id, parseRes.data.rating);
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

    const { id, score } = parse.data;
    const word = vocabService.getById(id);
    if (!word) {
      return reply.status(404).send({ success: false, error: 'Word not found' });
    }

    const db = getDatabase();
    db.prepare(`
      INSERT INTO user_vocab_progress (word_id, current_score, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(word_id) DO UPDATE SET
        current_score = excluded.current_score,
        updated_at = CURRENT_TIMESTAMP
    `).run(word.id, score);

    try {
      markdownSyncService.updateWordScore(word.word, score);
    } catch {
      // Non-blocking silent sync
    }

    return { success: true, word_id: word.id, new_score: score };
  });
}
