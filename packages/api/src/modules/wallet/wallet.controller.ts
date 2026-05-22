import { FastifyRequest, FastifyReply } from 'fastify';
import { topupSchema, paginationSchema } from './wallet.schema';
import { WalletService } from './wallet.service';

export class WalletController {
    static async getBalance(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const balance = await WalletService.getBalance(userId);
            return reply.send({ success: true, data: balance });
        } catch (error) {
            return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch balance' }});
        }
    }

    static async getTransactions(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const query = paginationSchema.parse(request.query);
            const transactions = await WalletService.getTransactions(userId, query.page, query.limit);
            return reply.send({ success: true, data: transactions });
        } catch (error) {
            return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch transactions' }});
        }
    }

    static async topup(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const { amount_fils } = topupSchema.parse(request.body);
            const result = await WalletService.topup(userId, amount_fils);
            return reply.send({ success: true, data: result });
        } catch (error: any) {
             if (error.name === 'ZodError') return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
             return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not top-up wallet' }});
        }
    }
}
