import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const categoriesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/', async (request, reply) => {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            orderBy: { nameEn: 'asc' }
        });
        return reply.send({ success: true, data: categories });
    } catch (error) {
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch categories' }});
    }
  });
};
