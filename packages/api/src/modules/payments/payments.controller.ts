import { FastifyRequest, FastifyReply } from 'fastify';
import { initiatePaymentSchema } from './payments.schema';
import { PaymentsService } from './payments.service';

export class PaymentsController {
    static async initiatePayment(request: FastifyRequest, reply: FastifyReply) {
        try {
            const customerId = request.user!.id;
            const data = initiatePaymentSchema.parse(request.body);
            const result = await PaymentsService.initiatePayment(customerId, data);
            return reply.send({ success: true, data: result });
        } catch (error: any) {
            if (error.name === 'ZodError') return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
            if (['NOT_FOUND', 'INVALID_TASK_STATUS', 'ALREADY_PAID', 'PRICE_NOT_SET', 'INVALID_PROMO'].includes(error.message)) {
                return reply.status(400).send({ success: false, error: { code: error.message, message: error.message }});
            }
            if (error.message === 'INSUFFICIENT_FUNDS') {
                 return reply.status(402).send({ success: false, error: { code: 'PAYMENT_REQUIRED', message: 'Insufficient wallet balance' }});
            }
            return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not process payment' }});
        }
    }

    static async getPaymentDetails(request: FastifyRequest<{ Params: { taskId: string }}>, reply: FastifyReply) {
        try {
            const customerId = request.user!.id;
            const result = await PaymentsService.getPaymentDetails(request.params.taskId, customerId);
            return reply.send({ success: true, data: result });
        } catch (error: any) {
            if (error.message === 'NOT_FOUND') return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' }});
            return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch payment' }});
        }
    }
}
