import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
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
});
