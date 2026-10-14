import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from '../../services/analytics.service.js';

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/summary', async (req: FastifyRequest<{ Querystring: { user_id?: string } }>, reply: FastifyReply) => {
    const userId = req.query.user_id || 'default_user';
    const summary = analyticsService.getDashboardSummary(userId);
    return reply.send({
      success: true,
      data: summary
    });
  });
}
