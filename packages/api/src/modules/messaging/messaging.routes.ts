import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { MessagingController } from './messaging.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export const messagingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  app.get('/tasks/:taskId/messages', MessagingController.getMessages);
};
