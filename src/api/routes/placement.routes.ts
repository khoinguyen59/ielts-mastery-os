import { FastifyInstance, FastifyRequest } from 'fastify';
import { placementService, LEVEL_PRESETS } from '../../services/placement.service.js';
import { DiagnosticSubmissionSchema, PresetLevel } from '../../types/placement.types.js';

function extractUserId(request: FastifyRequest, bodyUserId?: string): string {
  const headerId = request.headers['x-user-id'];
  if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();
  if (bodyUserId && bodyUserId.trim()) return bodyUserId.trim();
  return 'default_user';
}

export async function placementRoutes(app: FastifyInstance) {
  // Predefined 5-tier levels
  app.get('/api/placement/presets', async () => ({ success: true, data: placementService.getLevelPresets() }));
  app.get('/api/placement/levels', async () => LEVEL_PRESETS);

  // Direct level selection (with user_id and onboarding update)
  app.post('/api/placement/select-level', async (request) => {
    const body = (request.body || {}) as { level_key?: string; level?: string; user_id?: string };
    const levelKey = (body.level_key || body.level || 'intermediate') as PresetLevel;
    const userId = extractUserId(request, body.user_id);
    const lvl = placementService.selectLevel(levelKey, userId);

    return {
      success: true,
      level: lvl,
      user_stats: { starting_band: lvl.band, target_band: lvl.band },
      fsrs_params: { stability: lvl.fsrs_initial_stability, target_retention: lvl.fsrs_target_retention }
    };
  });

  // 8-question adaptive diagnostic test
  app.get('/api/placement/diagnostic', async (request) => {
    const query = request.query as { count?: string };
    const count = query.count ? parseInt(query.count, 10) : 8;
    const questions = placementService.generateDiagnosticTest(count);
    return { success: true, count: questions.length, data: questions };
  });

  // Alias for UI: GET /api/placement/test
  app.get('/api/placement/test', async (request) => {
    const query = request.query as { count?: string };
    const count = query.count ? parseInt(query.count, 10) : 8;
    const questions = placementService.generateDiagnosticTest(count);
    return {
      total: questions.length,
      questions: questions.map(q => ({
        id: q.id,
        target_band: q.target_band,
        tier: q.focus_area,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation
      }))
    };
  });

  // Canonical evaluate endpoint
  app.post('/api/placement/evaluate', async (request, reply) => {
    const parse = DiagnosticSubmissionSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ success: false, error: parse.error.flatten() });

    const body = request.body as { answers: Record<string, number>; user_id?: string };
    const userId = extractUserId(request, body.user_id);
    const result = placementService.evaluateTest(parse.data.answers, userId);
    return { success: true, data: result };
  });

  // Alias for UI: POST /api/placement/submit
  app.post('/api/placement/submit', async (request, reply) => {
    const parse = DiagnosticSubmissionSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });

    const body = request.body as { answers: Record<string, number>; user_id?: string };
    const userId = extractUserId(request, body.user_id);
    const res = placementService.evaluateTest(parse.data.answers, userId);
    const lvl = LEVEL_PRESETS[res.assigned_level_key];

    return {
      success: true,
      estimated_band: res.estimated_band,
      assigned_level_key: res.assigned_level_key,
      assigned_level_title: lvl.title,
      correct_count: res.correct_answers,
      total_questions: res.total_questions,
      accuracy_pct: Math.round(res.accuracy * 100),
      recommended_daily_vocab: lvl.recommended_daily,
      fsrs_params: res.fsrs_params,
      feedback: `Bạn đạt độ chính xác ${Math.round(res.accuracy * 100)}%, phù hợp với lộ trình ${lvl.title}. FSRS Stability: ${lvl.fsrs_initial_stability}.`
    };
  });
}
