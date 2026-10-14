import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { getDatabase } from '../../src/db/sqlite.js';
import { FastifyInstance } from 'fastify';

describe('Feedback Routes & Anti-Spam Trust Metrics', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    const db = getDatabase();
    db.prepare("DELETE FROM question_feedback_logs WHERE user_id = 'default_user'").run();
  });

  it('submits valid question dispute and earns positive reward', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback/submit',
      payload: {
        user_id: 'default_user',
        question_id: 'q_seed_1',
        reason: 'grammar_typo',
        details: 'Spelling error in question prompt word.'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.metrics).toBeDefined();
  });

  it('fetches user trust metrics correctly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/feedback/user-metrics?user_id=default_user'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.trust_score).toBe('number');
  });

  it('submits feedback with wrong_collocation reason successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback/submit',
      payload: {
        user_id: 'default_user',
        question_id: 'q_seed_1',
        reason: 'wrong_collocation',
        details: 'Collocation does not match academic register.'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});
