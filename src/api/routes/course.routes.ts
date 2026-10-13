import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { courseService } from '../../services/course.service.js';
import { PresetLevel } from '../../types/placement.types.js';

function extractUserId(request: any): string {
  const query = request.query as any;
  const body = request.body as any;
  const headers = request.headers as any;
  return body?.user_id || query?.user_id || headers?.['x-user-id'] || 'default_user';
}

export const courseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/courses/active: returns active course for current user based on placement level
  fastify.get('/api/courses/active', async (request, reply) => {
    try {
      const userId = extractUserId(request);
      const query = request.query as any;
      const explicitLevel = query?.level as PresetLevel;

      let courseInfo;
      if (explicitLevel && ['starter', 'foundation', 'intermediate', 'advanced', 'mastery'].includes(explicitLevel)) {
        const course = courseService.getCourse(explicitLevel);
        courseInfo = { course, levelKey: explicitLevel, band: course.targetBand };
      } else {
        courseInfo = courseService.getCourseForUser(userId);
      }

      return reply.status(200).send({
        success: true,
        data: {
          level_key: courseInfo.levelKey,
          target_band: courseInfo.band,
          course: courseInfo.course
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch active course' });
    }
  });

  // GET /api/courses/all: returns all 5 leveled courses
  fastify.get('/api/courses/all', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      data: courseService.getAllCourses()
    });
  });

  // POST /api/courses/switch: switches active course for user
  fastify.post('/api/courses/switch', async (request, reply) => {
    try {
      const body = request.body as any;
      const userId = extractUserId(request);
      const levelKey = (body?.level_key || body?.level || 'intermediate') as PresetLevel;

      const course = courseService.assignCourse(userId, levelKey);
      return reply.status(200).send({
        success: true,
        message: `Đã kích hoạt ${course.title}`,
        data: {
          level_key: levelKey,
          course
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to switch course' });
    }
  });
};

export default courseRoutes;
