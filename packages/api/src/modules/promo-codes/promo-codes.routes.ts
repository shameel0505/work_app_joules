import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PromoCodesController } from './promo-codes.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export const promoCodesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate);
    app.post('/validate', PromoCodesController.validatePromo);
};
