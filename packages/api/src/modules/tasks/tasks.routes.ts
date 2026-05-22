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

  app.post('/:id/bids', { preHandler: [requireRole(['TASKER'])] }, TasksController.placeBid);
  app.get('/:id/bids', { preHandler: [requireRole(['CUSTOMER'])] }, TasksController.getBids);
  app.post('/:id/bids/:bidId/accept', { preHandler: [requireRole(['CUSTOMER'])] }, TasksController.acceptBid);
  app.delete('/:id/bids/:bidId', { preHandler: [requireRole(['TASKER'])] }, TasksController.withdrawBid);
  
  app.patch('/:id/start', { preHandler: [requireRole(['TASKER'])] }, TasksController.startTask);
  app.patch('/:id/complete', { preHandler: [requireRole(['TASKER'])] }, TasksController.completeTask);
};
