import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class MessagingService {
    static async getMessages(taskId: string, userId: string, role: string, page: number = 1, limit: number = 50) {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { tasker: true }
        });

        if (!task) throw new Error('NOT_FOUND');

        // Access check
        if (role === 'CUSTOMER' && task.customerId !== userId) {
            throw new Error('NOT_FOUND');
        } else if (role === 'TASKER' && task.tasker?.userId !== userId) {
            throw new Error('NOT_FOUND');
        }

        const skip = (page - 1) * limit;

        const messages = await prisma.message.findMany({
            where: { taskId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                sender: { select: { id: true, firstName: true, avatarUrl: true }}
            }
        });

        // Mark unread messages sent by the *other* party as read
        const unreadIds = messages
            .filter(m => !m.readAt && m.senderId !== userId)
            .map(m => m.id);

        if (unreadIds.length > 0) {
            await prisma.message.updateMany({
                where: { id: { in: unreadIds } },
                data: { readAt: new Date() }
            });
            
            // Re-fetch to return updated readAt status
            return prisma.message.findMany({
                where: { taskId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: { select: { id: true, firstName: true, avatarUrl: true }}
                }
            });
        }

        return messages;
    }
}
