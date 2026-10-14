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
import { analyticsService } from '../services/analytics.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test'
  });

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
  app.get('/api/analytics', async (req) => {
    const userId = (req.query as any)?.user_id || 'default_user';
    return await analyticsService.getDashboardSummary(userId);
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
