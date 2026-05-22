import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = new PrismaClient();

export const releasePaymentQueue = new Queue('release-payment', { connection: redisConnection });

export const releasePaymentWorker = new Worker('release-payment', async (job: Job) => {
    const { taskId } = job.data;
    
    // Process payment release
    await prisma.$transaction(async (tx) => {
        const task = await tx.task.findUnique({
            where: { id: taskId },
            include: { tasker: { include: { user: true } } }
        });

        if (!task || !task.tasker || !task.priceFinal || task.status !== 'COMPLETED') {
            console.error(`Invalid task for payment release: ${taskId}`);
            return;
        }

        const priceFinal = task.priceFinal;
        const platformFeeFils = Math.floor(priceFinal * 0.20);
        const taskerPayoutFils = Math.floor(priceFinal * 0.80);

        // 1. Create simulated payment record
        await tx.payment.create({
            data: {
                taskId: task.id,
                customerId: task.customerId,
                amountFils: priceFinal,
                status: 'CAPTURED', // SIMULATION
                providerPaymentId: `sim_${Date.now()}`
            }
        });

        // 2. Add payout to tasker's wallet
        await tx.user.update({
            where: { id: task.tasker.userId },
            data: { walletBalanceFils: { increment: taskerPayoutFils } }
        });

        // 3. Create wallet transaction record for the tasker
        await tx.walletTransaction.create({
             data: {
                 userId: task.tasker.userId,
                 amountFils: taskerPayoutFils,
                 description: `Payout for task ${task.id}`
             }
        });

        console.log(`SIMULATED PAYMENT RELEASED: AED ${taskerPayoutFils / 100} to tasker ${task.tasker.userId} for task ${taskId}. Platform fee: AED ${platformFeeFils / 100}`);
    });
}, { connection: redisConnection });
