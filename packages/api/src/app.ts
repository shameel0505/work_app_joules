import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';

import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { taskersRoutes } from "./modules/taskers/taskers.routes";
import { categoriesRoutes } from "./modules/categories/categories.routes";
import { tasksRoutes } from "./modules/tasks/tasks.routes";

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
  app.register(usersRoutes, { prefix: '/api/v1/users' });
  app.register(taskersRoutes, { prefix: '/api/v1/taskers' });
  app.register(categoriesRoutes, { prefix: '/api/v1/categories' });
  app.register(tasksRoutes, { prefix: '/api/v1/tasks' });

  // Health check route
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
};
