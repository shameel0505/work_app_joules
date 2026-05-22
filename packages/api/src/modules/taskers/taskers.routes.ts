import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TaskersController } from './taskers.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export const taskersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/:id/public', TaskersController.getPublicProfile);

  app.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', authenticate);
      
      protectedRoutes.get('/me', TaskersController.getProfile);
      protectedRoutes.patch('/me', TaskersController.updateProfile);
      protectedRoutes.post('/me/emirates-id', TaskersController.uploadEmiratesId);
      protectedRoutes.patch('/me/availability', TaskersController.updateAvailability);
      protectedRoutes.patch('/me/location', TaskersController.updateLocation);

      protectedRoutes.get('/me/earnings', TaskersController.getEarnings);
      protectedRoutes.get('/me/earnings/transactions', TaskersController.getEarningsTransactions);
      protectedRoutes.post('/me/payout/request', TaskersController.requestPayout);
  });
};
