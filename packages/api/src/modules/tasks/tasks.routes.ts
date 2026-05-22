import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TasksController } from './tasks.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { requireRole } from '../../shared/middleware/requireRole';

export const tasksRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  app.post('/', { preHandler: [requireRole(['CUSTOMER'])] }, TasksController.createTask);
  app.get('/', { preHandler: [requireRole(['CUSTOMER'])] }, TasksController.getTasks);
  app.get('/:id', TasksController.getTaskDetail);
  app.patch('/:id/cancel', { preHandler: [requireRole(['CUSTOMER'])] }, TasksController.cancelTask);
  
  app.get('/available', { preHandler: [requireRole(['TASKER'])] }, TasksController.getAvailableTasks);
};
