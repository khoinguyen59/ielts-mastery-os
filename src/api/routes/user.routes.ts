import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { userService } from '../../services/user.service.js';

function extractUserId(request: any): string {
  const query = request.query as any;
  const body = request.body as any;
  const headers = request.headers as any;
  return body?.user_id || query?.user_id || headers?.['x-user-id'] || 'default_user';
}

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/user/progress: returns active user's lesson progress and stats
  fastify.get('/api/user/progress', async (request, reply) => {
    try {
      const query = request.query as any;
      const userId = extractUserId(request);
      const unitId = query?.unit_id || 'unit_01';
      const progression = await userService.getNodeProgression(userId, unitId);
      const stats = await userService.getUserStats(userId);

      return reply.status(200).send({
        success: true,
        unit_id: progression.unit_id,
        unlocked_node: progression.unlocked_node,
        completed_nodes: progression.completed_nodes,
        stats
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch progress' });
    }
  });

  // POST /api/user/progress/node: completes lesson node for unit, updates SQLite
  fastify.post('/api/user/progress/node', async (request, reply) => {
    try {
      const body = request.body as any;
      const userId = extractUserId(request);
      const unitId = body?.unit_id || 'unit_01';
      const nodeIndex = Number(body?.completed_node_index ?? body?.node_index);

      if (isNaN(nodeIndex) || nodeIndex < 1 || nodeIndex > 5) {
        return reply.status(400).send({ success: false, error: 'Valid node_index (1-5) is required' });
      }

      const result = await userService.completeLessonNode(userId, unitId, nodeIndex);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to complete node' });
    }
  });

  // POST /api/user/hearts/deduct: decrements heart, updates SQLite user_stats
  fastify.post('/api/user/hearts/deduct', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const result = await userService.deductHeart(userId);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to deduct heart' });
    }
  });

  // POST /api/user/hearts/refill: handles coin refill (50 coins -> 5 hearts) or practice (+1 heart)
  fastify.post('/api/user/hearts/refill', async (request, reply) => {
    try {
      const body = request.body as any;
      const userId = extractUserId(request);
      const refillType = body?.refill_type === 'practice' ? 'practice' : 'coins';

      const result = await userService.refillHearts(userId, refillType);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to refill hearts' });
    }
  });

  // GET /api/user/stats: returns user statistics from SQLite user_stats
  fastify.get('/api/user/stats', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const stats = await userService.getUserStats(userId);
      return reply.status(200).send({ success: true, stats });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch user stats' });
    }
  });
};

export default userRoutes;
