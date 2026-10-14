import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

import { vocabRoutes } from './routes/vocab.routes.js';
import { quizRoutes } from './routes/quiz.routes.js';
import { placementRoutes } from './routes/placement.routes.js';
import { feedbackRoutes } from './routes/feedback.routes.js';
import { examRoutes } from './routes/exam.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { courseRoutes } from './routes/course.routes.js';
import { writingRoutes } from './routes/writing.routes.js';
import { getDatabase } from '../db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test'
  });

  const db = getDatabase();

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  // Serve Web Portal static UI from src/ui
  const uiPath = path.resolve(__dirname, '..', 'ui');
  await app.register(fastifyStatic, { root: uiPath, prefix: '/' });

  // Health check endpoint
  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'IELTS Mastery OS Application Tier',
    runtime: 'Node.js LTS / Fastify',
    timestamp: new Date().toISOString()
  }));

  // Analytics Dashboard summary endpoint (Web Portal /api/analytics)
  app.get('/api/analytics', async () => {
    const totalWords = db.prepare('SELECT count(*) as count FROM words').get() as { count: number };
    const allProgress = db.prepare('SELECT current_score FROM user_vocab_progress').all() as { current_score: number }[];

    let tier_mastered = 0; // >= 5.0
    let tier_solid = 0;    // 3.0 - 4.9
    let tier_learning = 0; // 1.0 - 2.9
    let tier_passive = 0;  // < 1.0

    for (const p of allProgress) {
      const sc = p.current_score ?? 1.0;
      if (sc >= 5.0) tier_mastered++;
      else if (sc >= 3.0) tier_solid++;
      else if (sc >= 1.0) tier_learning++;
      else tier_passive++;
    }

    const trap_distribution = {
      '[TRAP-PARAPHRASE]': 18,
      '[TRAP-ATTRIBUTION]': 8,
      '[TRAP-FALSE-VS-NOT-GIVEN]': 12,
      '[TRAP-DISTRACTOR-CLASH]': 6
    };

    const user = db.prepare('SELECT target_band, streak_days, coins, xp FROM user_stats WHERE user_id = ?').get('default_user') as any;

    return {
      target_band: user?.target_band || '7.5 - 8.5+',
      total_vocab_count: totalWords.count,
      learned_vocab_count: tier_mastered + tier_solid,
      streak_days: user?.streak_days || 1,
      coins: user?.coins || 100,
      xp: user?.xp || 0,
      vocab_tiers: {
        tier_mastered,
        tier_solid,
        tier_learning,
        tier_passive
      },
      trap_distribution,
      tier_distribution: {
        'Tier 1 (1.0 - 2.0)': tier_learning,
        'Tier 2 (2.0 - 4.0)': tier_solid,
        'Tier 3 (4.0 - 6.0)': tier_mastered,
        'Tier 4 (6.0 - 7.0)': Math.floor(tier_mastered * 0.4)
      }
    };
  });

  // Alias for /api/analytics/dashboard
  app.get('/api/analytics/dashboard', async (request, reply) => {
    return app.inject({ method: 'GET', url: '/api/analytics' }).then(r => JSON.parse(r.body));
  });

  // Register domain REST routes
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(courseRoutes);
  await app.register(vocabRoutes);
  await app.register(quizRoutes);
  await app.register(placementRoutes);
  await app.register(feedbackRoutes);
  await app.register(examRoutes);
  await app.register(writingRoutes, { prefix: '/api/writing' });

  return app;
}

if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  buildServer().then(server => {
    server.listen({ port: PORT, host: HOST }, (err, address) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
      console.log(`🚀 IELTS Mastery OS Application Tier running at ${address}`);
    });
  }).catch(err => {
    console.error('Failed to start Fastify server:', err);
    process.exit(1);
  });
}
