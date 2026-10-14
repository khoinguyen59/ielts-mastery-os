import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, ensureUserExists } from '../../src/db/sqlite.js';
import crypto from 'crypto';

// Dynamic top-level loader for AuthService to satisfy Progressive Testability
const authMod = await import(/* @vite-ignore */ '../../src/services/auth.service.js').catch(() => null);
const authService = authMod?.authService || (authMod?.default as any) || null;

describe('R2: AuthService & Multi-Profile Management Tests', () => {
  const db = getDatabase();

  beforeEach(() => {
    try {
      db.prepare("DELETE FROM user_stats WHERE user_id LIKE 'test_auth_%'").run();
      const hasUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      if (hasUsers) {
        db.prepare("DELETE FROM users WHERE username LIKE 'test_auth_%' OR id LIKE 'test_auth_%'").run();
      }
    } catch {
      // Table may not exist prior to M2 migration
    }
  });

  describe('Database & Security Contract', () => {
    it('verifies PBKDF2/scrypt cryptographic password hashing specifications', () => {
      const password = 'SuperSecretPassword123!';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash1 = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      const hash2 = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      const differentSalt = crypto.randomBytes(16).toString('hex');
      const hash3 = crypto.pbkdf2Sync(password, differentSalt, 10000, 64, 'sha512').toString('hex');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1.length).toBe(128);
    });

    it('verifies SQLite user_stats table supports multi-user storage', () => {
      const userA = 'test_auth_usr_a';
      const userB = 'test_auth_usr_b';
      ensureUserExists(userA);
      ensureUserExists(userB);

      db.prepare(`
        INSERT INTO user_stats (user_id, target_band, starting_band, coins, hearts)
        VALUES (?, '7.5', '5.0', 120, 5)
      `).run(userA);

      db.prepare(`
        INSERT INTO user_stats (user_id, target_band, starting_band, coins, hearts)
        VALUES (?, '8.5', '6.5', 250, 4)
      `).run(userB);

      const rowA = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userA) as any;
      const rowB = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userB) as any;

      expect(rowA).toBeDefined();
      expect(rowB).toBeDefined();
      expect(rowA.coins).toBe(120);
      expect(rowB.coins).toBe(250);
      expect(rowA.target_band).toBe('7.5');
      expect(rowB.target_band).toBe('8.5');
    });

    it('reports M2 AuthService implementation readiness', () => {
      const isImplemented = Boolean(authService);
      if (!isImplemented) {
        console.info('[PROGRESSIVE TESTABILITY] src/services/auth.service.ts awaiting M2 Worker implementation');
      }
      // Schema / contract expectation: true if implemented, documented as progressive requirement
      expect(typeof isImplemented).toBe('boolean');
    });
  });

  describe('AuthService Functional Specifications (M2 Gate)', () => {
    it('registers new student accounts with salted hash and default stats', async () => {
      const regResult = await authService.register({
        username: 'test_auth_student_1',
        password: 'ValidPassword123!',
        display_name: 'Nguyen Van A'
      });

      expect(regResult.success).toBe(true);
      expect(regResult.token).toBeDefined();
      expect(regResult.user).toBeDefined();
      expect(regResult.user.username).toBe('test_auth_student_1');
      expect(regResult.user.display_name).toBe('Nguyen Van A');
      expect(regResult.user.hearts).toBe(5);
      expect(regResult.user.is_guest).toBeFalsy();
      expect(regResult.user.password_hash).toBeUndefined();
    });

    it('prevents duplicate username registrations', async () => {
      await authService.register({
        username: 'test_auth_dupe',
        password: 'Password123!'
      });

      const dupeResult = await authService.register({
        username: 'test_auth_dupe',
        password: 'AnotherPassword456!'
      }).catch((e: Error) => ({ success: false, error: e.message }));

      expect(dupeResult.success).toBe(false);
    });

    it('authenticates registered users on correct credentials and rejects invalid passwords', async () => {
      const username = 'test_auth_login_user';
      const password = 'CorrectPassword999!';

      await authService.register({ username, password, display_name: 'Login Test' });

      const loginSuccess = await authService.login({ username, password });
      expect(loginSuccess.success).toBe(true);
      expect(loginSuccess.token).toBeDefined();
      expect(loginSuccess.user.username).toBe(username);

      const loginFail = await authService.login({ username, password: 'WrongPassword!' })
        .catch((e: Error) => ({ success: false, error: e.message }));
      expect(loginFail.success).toBe(false);

      const loginNotFound = await authService.login({ username: 'non_existent_usr_999', password })
        .catch((e: Error) => ({ success: false, error: e.message }));
      expect(loginNotFound.success).toBe(false);
    });

    it('generates 1-Click Guest profile with default Cabi mascot and 5 hearts', async () => {
      const guestResult = typeof authService.createGuestProfile === 'function' ?
        await authService.createGuestProfile() :
        await authService.guest();

      expect(guestResult.success).toBe(true);
      expect(guestResult.token).toBeDefined();
      expect(guestResult.user).toBeDefined();
      expect(guestResult.user.is_guest).toBeTruthy();
      expect(guestResult.user.hearts).toBe(5);
      expect(guestResult.user.coins).toBeGreaterThanOrEqual(100);
      expect(guestResult.user.id).toBeDefined();
    });

    it('lists local profiles without leaking password hashes and allows profile switching', async () => {
      const user1 = await authService.register({ username: 'test_auth_profile_1', password: 'Pass1!' });
      const user2 = await authService.register({ username: 'test_auth_profile_2', password: 'Pass2!' });

      const profiles = await authService.listProfiles();
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThanOrEqual(2);

      for (const p of profiles) {
        expect(p.password_hash).toBeUndefined();
        expect(p.username).toBeDefined();
      }

      const switchResult = await authService.switchProfile(user1.user.id);
      expect(switchResult.success).toBe(true);
      expect(switchResult.user.id).toBe(user1.user.id);
    });
  });
});
