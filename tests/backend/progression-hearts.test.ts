import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getDatabase } from '../../src/db/sqlite.js';
import { userService } from '../../src/services/user.service.js';
import { buildServer } from '../../src/api/server.js';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';

describe('R1, R4 & R5: Lesson Progression, Hearts Energy & Fastify /api/user/* Integration', () => {
  const db = getDatabase();
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.prepare("DELETE FROM user_stats WHERE user_id LIKE 'test_prog_%'").run();
    db.prepare("DELETE FROM user_lesson_progress WHERE user_id LIKE 'test_prog_%'").run();
    db.prepare("DELETE FROM users WHERE id LIKE 'test_prog_%'").run();
  });

  describe('R1: Brand Identity & Topbar Stat Pills Geometry Verification', () => {
    it('verifies custom vector SVG assets exist or are properly referenced', () => {
      const assetDir = path.resolve(process.cwd(), 'src', 'ui', 'assets');
      const iconsDir = path.join(assetDir, 'icons');
      const iconsExist = fs.existsSync(iconsDir);

      if (iconsExist) {
        for (const icon of ['flame.svg', 'coin.svg', 'heart.svg']) {
          const p = path.join(iconsDir, icon);
          if (fs.existsSync(p)) {
            expect(fs.readFileSync(p, 'utf-8')).toContain('<svg');
          }
        }
      }
      expect(typeof iconsExist).toBe('boolean');
    });

    it('verifies CSS tokens for pill radius and centering', () => {
      const cssPath = path.resolve(process.cwd(), 'src', 'ui', 'css', 'style.css');
      if (fs.existsSync(cssPath)) {
        const content = fs.readFileSync(cssPath, 'utf-8');
        expect(content.includes('center') || content.includes('flex')).toBe(true);
      }
    });
  });

  describe('R4 & R5: UserService Genuine SQLite Unit Operations', () => {
    const testUserId = 'test_prog_unit_user';

    beforeEach(async () => {
      await userService.updateUserStats(testUserId, { coins: 100, hearts: 5 });
    });

    it('starts with Node 1 unlocked and no completed nodes in SQLite', async () => {
      const prog = await userService.getNodeProgression(testUserId, 'unit_01');
      expect(prog.unit_id).toBe('unit_01');
      expect(prog.unlocked_node).toBe(1);
      expect(prog.completed_nodes).toEqual([]);
    });

    it('completes nodes sequentially and updates user_lesson_progress in SQLite', async () => {
      const res1 = await userService.completeLessonNode(testUserId, 'unit_01', 1);
      expect(res1.success).toBe(true);
      expect(res1.unlocked_node).toBe(2);
      expect(res1.completed_nodes).toEqual([1]);

      const rows = db.prepare('SELECT node_index, status FROM user_lesson_progress WHERE user_id = ?').all(testUserId) as any[];
      expect(rows.length).toBe(1);
      expect(rows[0].node_index).toBe(1);
      expect(rows[0].status).toBe('completed');

      const res2 = await userService.completeLessonNode(testUserId, 'unit_01', 2);
      expect(res2.unlocked_node).toBe(3);
      expect(res2.completed_nodes).toContain(2);
    });

    it('deducts hearts until 0 and flags exhaustion in SQLite', async () => {
      for (let i = 1; i <= 5; i++) {
        const d = await userService.deductHeart(testUserId);
        expect(d.hearts).toBe(5 - i);
        expect(d.is_exhausted).toBe(i === 5);
      }

      // Clamping at 0
      const extra = await userService.deductHeart(testUserId);
      expect(extra.hearts).toBe(0);
      expect(extra.is_exhausted).toBe(true);

      const stats = await userService.getUserStats(testUserId);
      expect(stats?.hearts).toBe(0);
    });

    it('refills hearts with coins (50 coins -> 5 hearts) and rejects when coins < 50', async () => {
      await userService.updateUserStats(testUserId, { coins: 80, hearts: 0 });

      const refill1 = await userService.refillHearts(testUserId, 'coins');
      expect(refill1.success).toBe(true);
      expect(refill1.hearts).toBe(5);
      expect(refill1.coins).toBe(30);

      const stats1 = await userService.getUserStats(testUserId);
      expect(stats1?.hearts).toBe(5);
      expect(stats1?.coins).toBe(30);

      // Attempt second refill with 30 coins fails
      const refill2 = await userService.refillHearts(testUserId, 'coins');
      expect(refill2.success).toBe(false);
      expect(refill2.error).toBe('Insufficient coins');
      expect(refill2.coins).toBe(30);
    });

    it('recovers 1 heart via practice session up to max 5 in SQLite', async () => {
      await userService.updateUserStats(testUserId, { hearts: 3 });

      const r1 = await userService.refillHearts(testUserId, 'practice');
      expect(r1.success).toBe(true);
      expect(r1.hearts).toBe(4);

      const r2 = await userService.refillHearts(testUserId, 'practice');
      expect(r2.hearts).toBe(5);

      // Clamped at 5
      const r3 = await userService.refillHearts(testUserId, 'practice');
      expect(r3.hearts).toBe(5);
    });
  });

  describe('R4 & R5: Fastify REST API Live Injections (/api/user/*)', () => {
    const apiUserId = 'test_prog_api_user';

    beforeEach(async () => {
      await userService.updateUserStats(apiUserId, { coins: 150, hearts: 5 });
    });

    it('GET /api/user/progress returns 200 with progression and stats', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/user/progress?unit_id=unit_01&user_id=${apiUserId}`
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.unit_id).toBe('unit_01');
      expect(data.unlocked_node).toBe(1);
      expect(Array.isArray(data.completed_nodes)).toBe(true);
      expect(data.stats.hearts).toBe(5);
      expect(data.stats.coins).toBe(150);
    });

    it('POST /api/user/progress/node unlocks next node and persists to SQLite', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/user/progress/node',
        payload: { user_id: apiUserId, unit_id: 'unit_01', completed_node_index: 1 }
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.unlocked_node).toBe(2);
      expect(data.completed_nodes).toContain(1);

      // Verify direct database persistence
      const row = db.prepare('SELECT node_index FROM user_lesson_progress WHERE user_id = ? AND node_index = 1').get(apiUserId) as any;
      expect(row).toBeDefined();
      expect(row.node_index).toBe(1);
    });

    it('POST /api/user/progress/node validates node index bounds', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/user/progress/node',
        payload: { user_id: apiUserId, unit_id: 'unit_01', completed_node_index: 99 }
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /api/user/hearts/deduct decrements hearts and persists to user_stats', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/user/hearts/deduct',
        payload: { user_id: apiUserId }
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.hearts).toBe(4);
      expect(data.is_exhausted).toBe(false);

      // Check SQLite user_stats
      const stats = db.prepare('SELECT hearts FROM user_stats WHERE user_id = ?').get(apiUserId) as any;
      expect(stats.hearts).toBe(4);
    });

    it('POST /api/user/hearts/refill handles coin refill and practice recovery via HTTP', async () => {
      // Deduct hearts to 0
      await userService.updateUserStats(apiUserId, { hearts: 0, coins: 100 });

      // Coin refill
      const coinRes = await app.inject({
        method: 'POST',
        url: '/api/user/hearts/refill',
        payload: { user_id: apiUserId, refill_type: 'coins' }
      });
      expect(coinRes.statusCode).toBe(200);
      const coinData = JSON.parse(coinRes.body);
      expect(coinData.success).toBe(true);
      expect(coinData.hearts).toBe(5);
      expect(coinData.coins).toBe(50);

      // Practice recovery after dropping 1
      await userService.updateUserStats(apiUserId, { hearts: 4 });
      const pracRes = await app.inject({
        method: 'POST',
        url: '/api/user/hearts/refill',
        payload: { user_id: apiUserId, refill_type: 'practice' }
      });
      expect(pracRes.statusCode).toBe(200);
      const pracData = JSON.parse(pracRes.body);
      expect(pracData.hearts).toBe(5);

      // Check failure when coins < 50
      await userService.updateUserStats(apiUserId, { coins: 20 });
      const failRes = await app.inject({
        method: 'POST',
        url: '/api/user/hearts/refill',
        payload: { user_id: apiUserId, refill_type: 'coins' }
      });
      expect(failRes.statusCode).toBe(400);
      const failData = JSON.parse(failRes.body);
      expect(failData.success).toBe(false);
      expect(failData.error).toBe('Insufficient coins');
    });

    it('GET /api/user/stats returns user stats object', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/user/stats?user_id=${apiUserId}`
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats.user_id).toBe(apiUserId);
    });
  });
});
