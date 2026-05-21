import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UsersController } from './users.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export const usersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('preHandler', authenticate);

  app.get('/me', UsersController.getProfile);
  app.patch('/me', UsersController.updateProfile);
  app.post('/me/avatar', UsersController.uploadAvatar);
  app.get('/me/addresses', UsersController.getAddresses);
  app.post('/me/addresses', UsersController.createAddress);
  app.delete('/me/addresses/:id', UsersController.deleteAddress);
};
