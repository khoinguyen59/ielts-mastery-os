import { FastifyInstance } from 'fastify';
import { examService } from '../../services/exam.service.js';
import { z } from 'zod';

const SubmitPassageSchema = z.object({
  answers: z.record(z.string(), z.string()),
  user_id: z.string().default('default_user')
});

const LegacyExamSubmitSchema = z.object({
  passage_id: z.string(),
  answers: z.record(z.string(), z.string()),
  user_id: z.string().default('default_user')
});

const SubmitWritingSchema = z.object({
  submission_text: z.string().min(5),
  user_id: z.string().default('default_user')
});

const LegacyWritingSubmitSchema = z.object({
  chunk_id: z.string(),
  user_text: z.string().min(5),
  user_id: z.string().default('default_user')
});

export async function examRoutes(app: FastifyInstance) {
  // Get all Cambridge 21 reading passages
  app.get('/api/exam/passages', async () => {
    const passages = examService.getAllPassages();
    return { success: true, count: passages.length, data: passages };
  });

  // Legacy alias: GET /api/exams
  app.get('/api/exams', async () => {
    const passages = examService.getAllPassages();
    return { total: passages.length, data: passages };
  });

  // Get specific reading passage
  app.get('/api/exam/passages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const passage = examService.getPassage(id);
    if (!passage) return reply.status(404).send({ success: false, error: 'Passage not found' });
    return { success: true, data: passage };
  });

  // Legacy alias: GET /api/exams/:id
  app.get('/api/exams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const passage = examService.getPassage(id);
    if (!passage) return reply.status(404).send({ error: 'Passage not found' });
    return passage;
  });

  // Evaluate reading test submission
  app.post('/api/exam/passages/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = SubmitPassageSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ success: false, error: parse.error.flatten() });

    try {
      const result = examService.evaluatePassageSubmission(id, parse.data.answers, parse.data.user_id);
      return { success: true, data: result };
    } catch (err: any) {
      return reply.status(404).send({ success: false, error: err.message });
    }
  });

  // Legacy alias: POST /api/exams/submit
  app.post('/api/exams/submit', async (request, reply) => {
    const parse = LegacyExamSubmitSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });

    try {
      const res = examService.evaluatePassageSubmission(parse.data.passage_id, parse.data.answers, parse.data.user_id);
      return {
        correct_answers: res.correct_answers,
        total_questions: res.total_questions,
        percentage: Math.round(res.score_ratio * 100),
        estimated_band: res.estimated_band,
        details: res.detailed_results
      };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // Get Reading-to-Writing micro-chunks
  app.get('/api/exam/writing-chunks', async () => {
    const chunks = examService.getWritingChunks();
    return { success: true, count: chunks.length, data: chunks };
  });

  // Legacy alias: GET /api/writing-chunks/:id
  app.get('/api/writing-chunks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chunk = examService.getWritingChunkById(id);
    if (!chunk) return reply.status(404).send({ error: 'Chunk not found' });
    return chunk;
  });

  // Evaluate Reading-to-Writing submission via AI Bridge
  app.post('/api/exam/writing-chunks/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = SubmitWritingSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ success: false, error: parse.error.flatten() });

    try {
      const result = await examService.evaluateWritingChunk(id, parse.data.submission_text, parse.data.user_id);
      return { success: true, data: result };
    } catch (err: any) {
      return reply.status(404).send({ success: false, error: err.message });
    }
  });

  // Legacy alias: POST /api/writing/submit
  app.post('/api/writing/submit', async (request, reply) => {
    const parse = LegacyWritingSubmitSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() });

    try {
      const result = await examService.evaluateWritingChunk(parse.data.chunk_id, parse.data.user_text, parse.data.user_id);
      return {
        feedback: result.score_ratio >= 0.7 ? 'Tuyệt vời! Bản dịch tự nhiên chuẩn IELTS 7.5+' : 'Tốt, hãy đối chiếu cụm Collocation với câu mẫu 8.5+',
        matched_words: result.matched_words,
        missing_words: result.missing_words,
        score_ratio: result.score_ratio,
        estimated_band: result.estimated_band,
        band_75_model: result.band_75_model,
        band_85_model: result.band_85_model
      };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });
}
