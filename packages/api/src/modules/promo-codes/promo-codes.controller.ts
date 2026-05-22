import { FastifyRequest, FastifyReply } from 'fastify';
import { validatePromoSchema } from './promo-codes.schema';
import { PromoCodesService } from './promo-codes.service';

export class PromoCodesController {
    static async validatePromo(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { code, task_price_fils } = validatePromoSchema.parse(request.body);
            const result = await PromoCodesService.validateCode(code, task_price_fils);
            return reply.send({ success: true, data: result });
        } catch (error: any) {
            if (error.name === 'ZodError') return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
            return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not validate promo code' }});
        }
    }
}
