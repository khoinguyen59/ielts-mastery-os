import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { writingService } from '../../services/writing.service.js';

interface EvaluateBody {
  chunk_id: string;
  user_submission: string;
  user_id?: string;
}

export async function writingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/chunks', async (_req: FastifyRequest, reply: FastifyReply) => {
    const chunks = writingService.getChunks();
    return reply.send({
      success: true,
      data: chunks
    });
  });

  fastify.get('/chunks/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const chunk = writingService.getChunkById(req.params.id);
    if (!chunk) {
      return reply.code(404).send({ success: false, error: 'Writing chunk not found' });
    }
    return reply.send({ success: true, data: chunk });
  });

  fastify.post('/evaluate', async (req: FastifyRequest<{ Body: EvaluateBody }>, reply: FastifyReply) => {
    const { chunk_id, user_submission, user_id } = req.body || {};
    if (!chunk_id || !user_submission) {
      return reply.code(400).send({
        success: false,
        error: 'Missing chunk_id or user_submission'
      });
    }

    try {
      const result = writingService.evaluateTranslation(chunk_id, user_submission, user_id || 'default_user');
      return reply.send({
        success: true,
        data: result
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evaluation failed';
      return reply.code(400).send({ success: false, error: msg });
    }
  });
}
