import { FastifyInstance } from 'fastify';
import { questionBankService } from '../../services/question-bank.service.js';
import { FeedbackSubmissionSchema } from '../../types/feedback.types.js';
import { z } from 'zod';

const ResolveBodySchema = z.object({
  is_valid: z.boolean()
});

export async function feedbackRoutes(app: FastifyInstance) {
  // Submit question error or dispute
  app.post('/api/feedback/submit', async (request, reply) => {
    const parse = FeedbackSubmissionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: parse.error.flatten() });
    }

    const res = questionBankService.submitFeedback(parse.data);
    if (!res.success) {
      return reply.status(429).send({ success: false, message: res.message, metrics: res.metrics });
    }

    return { success: true, message: res.message, metrics: res.metrics };
  });

  // Resolve question feedback (Admin / Validator)
  app.post('/api/feedback/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = ResolveBodySchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, error: parse.error.flatten() });
    }

    const res = questionBankService.resolveFeedback(id, parse.data.is_valid);
    if (!res.success) {
      return reply.status(404).send({ success: false, error: 'Feedback log not found' });
    }

    return { success: true, data: res };
  });

  // Get current user's feedback stats and trust metrics
  app.get('/api/feedback/user-metrics', async (request) => {
    const query = request.query as { user_id?: string };
    const userId = query.user_id || 'default_user';
    const metrics = questionBankService.getUserTrustMetrics(userId);
    return { success: true, data: metrics };
  });
}
