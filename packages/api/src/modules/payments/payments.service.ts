import { PrismaClient } from '@prisma/client';
import { PaymentGatewayService } from './payment-gateway.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';

const prisma = new PrismaClient();

export class PaymentsService {
    static async initiatePayment(customerId: string, data: any) {
        const { task_id, payment_method, promo_code } = data;

        const task = await prisma.task.findUnique({
             where: { id: task_id, customerId },
             include: { customer: true }
        });

        if (!task) throw new Error('NOT_FOUND');
        if (task.status !== 'ACCEPTED') throw new Error('INVALID_TASK_STATUS');
        if (task.paymentStatus === 'PAID') throw new Error('ALREADY_PAID');
        if (!task.priceFinal) throw new Error('PRICE_NOT_SET');

        let taskPrice = task.priceFinal;

        if (promo_code) {
             const promoResult = await PromoCodesService.validateCode(promo_code, taskPrice);
             if (promoResult.valid) {
                 taskPrice = promoResult.final_amount_fils!;
                 // Increment uses count
                 await prisma.promoCode.update({ where: { code: promo_code }, data: { usesCount: { increment: 1 }}});
             } else {
                 throw new Error('INVALID_PROMO');
             }
        }

        const platformFeeFils = 500;
        const vatFils = Math.floor(platformFeeFils * 0.05); // 5% VAT on service fee only, int math
        const totalAmountFils = taskPrice + platformFeeFils + vatFils;

        if (payment_method === 'wallet') {
            return await prisma.$transaction(async (tx) => {
                 const user = await tx.user.findUnique({ where: { id: customerId } });
                 if (!user || user.walletBalanceFils < totalAmountFils) {
                     throw new Error('INSUFFICIENT_FUNDS');
                 }

                 // Deduct securely
                 await tx.user.update({
                     where: { id: customerId },
                     data: { walletBalanceFils: { decrement: totalAmountFils } }
                 });

                 // Record wallet tx
                 await tx.walletTransaction.create({
                     data: { userId: customerId, amountFils: -totalAmountFils, description: `Task Payment for ${task_id}` }
                 });

                 // Record Payment
                 const payment = await tx.payment.create({
                     data: {
                         taskId: task_id,
                         customerId,
                         amountFils: totalAmountFils,
                         status: 'CAPTURED',
                         providerPaymentId: `wallet_${Date.now()}`
                     }
                 });

                 // Update Task
                 await tx.task.update({
                     where: { id: task_id },
                     data: { paymentStatus: 'PAID' }
                 });

                 return { payment_id: payment.id, method: 'wallet' };
            });
        } else if (payment_method === 'card') {
            const intent = await PaymentGatewayService.createPaymentIntent(totalAmountFils, `task_${task_id}`);
            const capture = await PaymentGatewayService.capturePayment(intent.gateway_ref);

            return await prisma.$transaction(async (tx) => {
                 const payment = await tx.payment.create({
                     data: {
                         taskId: task_id,
                         customerId,
                         amountFils: totalAmountFils,
                         status: 'CAPTURED',
                         providerPaymentId: intent.gateway_ref
                     }
                 });

                 await tx.task.update({
                     where: { id: task_id },
                     data: { paymentStatus: 'PAID' }
                 });

                 return { payment_id: payment.id, method: 'card', simulated: true };
            });
        }
    }

    static async getPaymentDetails(taskId: string, customerId: string) {
        const payment = await prisma.payment.findFirst({
            where: { taskId, customerId },
            orderBy: { createdAt: 'desc' }
        });
        if (!payment) throw new Error('NOT_FOUND');
        return payment;
    }
}
