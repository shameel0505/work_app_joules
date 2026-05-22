import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = new PrismaClient();

export const approvePayoutQueue = new Queue('approve-payout', { connection: redisConnection });

export const approvePayoutWorker = new Worker('approve-payout', async (job: Job) => {
    const { payoutId } = job.data;
    
    // Simulate Auto-Approval process
    await prisma.$transaction(async (tx) => {
        const payout = await tx.payoutRequest.findUnique({ where: { id: payoutId } });
        if (!payout || payout.status !== 'PENDING') return;

        // Deduct from wallet balance
        const user = await tx.user.update({
            where: { id: payout.userId },
            data: { walletBalanceFils: { decrement: payout.amountFils } }
        });

        // Record a transaction for the withdrawal
        await tx.walletTransaction.create({
            data: {
                userId: payout.userId,
                amountFils: -payout.amountFils,
                description: `Payout to bank account ending in ${payout.iban.slice(-4)}`
            }
        });

        // Update payout status
        await tx.payoutRequest.update({
             where: { id: payoutId },
             data: { status: 'APPROVED' }
        });

        console.log(`SIMULATED PAYOUT: AED ${payout.amountFils / 100} to IBAN ${payout.iban} — auto-approving for user ${payout.userId}`);
    });

}, { connection: redisConnection });
