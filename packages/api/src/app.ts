import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';

import { authRoutes } from "./modules/auth/auth.routes";

export const buildApp = (opts: FastifyServerOptions = {}): FastifyInstance => {
  const app = fastify(opts);

  // Register plugins
  app.register(cors, {
    origin: '*',
    credentials: true
  });
  
  app.register(cookie);
  
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key'
  });
  
  app.register(multipart);

  app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Health check route
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
};
