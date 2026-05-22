import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PaymentsController } from './payments.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { requireRole } from '../../shared/middleware/requireRole';

export const paymentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate);
    
    app.post('/initiate', { preHandler: [requireRole(['CUSTOMER'])] }, PaymentsController.initiatePayment);
    app.get('/:taskId', { preHandler: [requireRole(['CUSTOMER'])] }, PaymentsController.getPaymentDetails);
};
