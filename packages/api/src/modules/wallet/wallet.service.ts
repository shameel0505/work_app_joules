import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WalletService {
    static async getBalance(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalanceFils: true }});
        if (!user) throw new Error('NOT_FOUND');
        return {
            balance_fils: user.walletBalanceFils,
            balance_aed: (user.walletBalanceFils / 100).toFixed(2)
        };
    }

    static async getTransactions(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        return prisma.walletTransaction.findMany({
            where: { userId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        });
    }

    static async topup(userId: string, amountFils: number) {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: { walletBalanceFils: { increment: amountFils } }
            });

            const transaction = await tx.walletTransaction.create({
                data: {
                    userId,
                    amountFils,
                    description: 'Wallet top-up (simulated)'
                }
            });

            console.log(`SIMULATED TOP-UP: AED ${amountFils / 100} added to user ${userId} wallet`);
            return { balance_fils: user.walletBalanceFils, transaction };
        });
    }
}
