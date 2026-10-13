import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authService } from '../../services/auth.service.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/api/auth/register', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body?.username || !body?.password) {
        return reply.status(400).send({ success: false, error: 'Username and password are required' });
      }
      const result = await authService.register({
        username: String(body.username).trim(),
        password: String(body.password),
        display_name: body.display_name ? String(body.display_name).trim() : undefined,
        target_band: body.target_band ? String(body.target_band) : undefined
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message || 'Registration failed' });
    }
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body?.username || !body?.password) {
        return reply.status(400).send({ success: false, error: 'Username and password are required' });
      }
      const result = await authService.login({
        username: String(body.username).trim(),
        password: String(body.password)
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(401).send({ success: false, error: err.message || 'Login failed' });
    }
  });

  fastify.post('/api/auth/guest', async (request, reply) => {
    try {
      const result = await authService.createGuestProfile();
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Guest creation failed' });
    }
  });

  fastify.get('/api/auth/profiles', async (request, reply) => {
    try {
      const profiles = await authService.listProfiles();
      return reply.status(200).send({ success: true, profiles });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to list profiles' });
    }
  });

  fastify.post('/api/auth/switch', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body?.user_id) {
        return reply.status(400).send({ success: false, error: 'user_id is required' });
      }
      const result = await authService.switchProfile(String(body.user_id));
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(404).send({ success: false, error: err.message || 'Switch profile failed' });
    }
  });

  fastify.get('/api/auth/me', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const sessionToken = (request.headers['x-session-token'] as string) || bearerToken;
      const userId = request.headers['x-user-id'] as string;

      let user = null;
      if (sessionToken) {
        user = await authService.verifySession(sessionToken);
      } else if (userId) {
        user = await authService.getUserById(userId);
      }

      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized or session expired' });
      }

      return reply.status(200).send({ success: true, user });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Auth check failed' });
    }
  });
};

export default authRoutes;
