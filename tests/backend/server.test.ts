import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { FastifyInstance } from 'fastify';

describe('Fastify REST API Gateway (Port 3000 / Endpoints)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 OK', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toContain('IELTS Mastery OS');
  });

  it('GET /api/vocab returns Master AWL vocabulary', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vocab' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(450);
  });

  it('GET /api/vocab/due returns reviewable words', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vocab/due?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('POST /api/vocab/:id/review updates FSRS review and score', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vocab/acquire/review',
      payload: { rating: 3 }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.new_score).toBeGreaterThanOrEqual(2.0);
  });

  it('POST /api/vocab/update-score updates word score directly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vocab/update-score',
      payload: { id: 'acquire', score: 6.5 }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.new_score).toBe(6.5);
  });

  it('GET /api/quiz/synthesis generates 80/20 round', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/quiz/synthesis?count=3' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);
  });

  it('GET /api/practice/quiz returns questions with word_id and badge for QuizBlitz', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/practice/quiz?count=3' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.questions).toHaveLength(3);
    expect(body.questions[0].word_id).toBeDefined();
    expect(body.questions[0].badge).toBe('Anh -> Việt');
  });

  it('POST /api/quiz/submit grades correct and wrong answers accurately', async () => {
    // 1. Get a synthesis question
    const roundRes = await app.inject({ method: 'GET', url: '/api/quiz/synthesis?count=1' });
    const q = JSON.parse(roundRes.body).data[0];

    // Submit correct answer
    const correctRes = await app.inject({
      method: 'POST',
      url: '/api/quiz/submit',
      payload: {
        question_id: q.id,
        selected_index: q.correct_index,
        target_word_id: q.target_word_id,
        user_id: 'default_user'
      }
    });
    expect(correctRes.statusCode).toBe(200);
    const correctBody = JSON.parse(correctRes.body);
    expect(correctBody.data.is_correct).toBe(true);

    // Submit wrong answer
    const wrongIdx = (q.correct_index + 1) % 4;
    const wrongRes = await app.inject({
      method: 'POST',
      url: '/api/quiz/submit',
      payload: {
        question_id: q.id,
        selected_index: wrongIdx,
        target_word_id: q.target_word_id,
        user_id: 'default_user'
      }
    });
    expect(wrongRes.statusCode).toBe(200);
    const wrongBody = JSON.parse(wrongRes.body);
    expect(wrongBody.data.is_correct).toBe(false);

    // Submit for non-existent question -> 404
    const notFoundRes = await app.inject({
      method: 'POST',
      url: '/api/quiz/submit',
      payload: {
        question_id: 'non_existent_q_999',
        selected_index: 0
      }
    });
    expect(notFoundRes.statusCode).toBe(404);
  });

  it('GET /api/placement/diagnostic returns 8 questions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/placement/diagnostic?count=8' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(8);
  });

  it('POST /api/placement/select-level updates user stats level', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/placement/select-level',
      payload: { level_key: 'advanced', user_id: 'test_server_user' }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.level.band).toBe('7.5');
    expect(body.level.recommended_daily).toBe(20);
  });

  it('GET /api/exam/passages and GET /api/exams return Cambridge 21 passages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exam/passages' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(5);

    const legacyRes = await app.inject({ method: 'GET', url: '/api/exams' });
    expect(legacyRes.statusCode).toBe(200);
    const legacyBody = JSON.parse(legacyRes.body);
    expect(legacyBody.total).toBeGreaterThanOrEqual(5);
  });

  it('POST /api/exam/writing-chunks/:id/submit evaluates writing chunk', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/writing-chunks/chunk_01/submit',
      payload: {
        submission_text: 'In contemporary society, the bulk of students seek to establish strong skills.'
      }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.matched_words).toContain('contemporary');
    expect(body.data.similarity_score).toBeGreaterThan(0.4);
  });

  it('GET /api/analytics returns vocab_tiers and trap_distribution for Web Portal UI', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.target_band).toBeDefined();
    expect(body.vocab_tiers).toBeDefined();
    expect(body.vocab_tiers.tier_mastered).toBeGreaterThanOrEqual(0);
    expect(body.trap_distribution).toBeDefined();
  });
});
