import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/send-otp', AuthController.sendOtp);
  app.post('/verify-otp', (req, rep) => AuthController.verifyOtp(app, req, rep));
  app.post('/refresh', (req, rep) => AuthController.refresh(app, req, rep));
  
  app.post('/logout', {
    preHandler: [authenticate]
  }, AuthController.logout);

  app.post('/admin-login', (req, rep) => AuthController.adminLogin(app, req, rep));
};
