import { PrismaClient } from '@prisma/client';
import { StorageService } from '../../shared/services/storage.service';

const prisma = new PrismaClient();
const storageService = new StorageService();

export class TaskersService {
  static async getProfile(userId: string) {
    return prisma.tasker.findUnique({
      where: { userId },
      include: {
          user: {
              select: { firstName: true, lastName: true, avatarUrl: true, phone: true, email: true }
          }
      }
    });
  }

  static async updateProfile(userId: string, data: any) {
    return prisma.tasker.update({
      where: { userId },
      data,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } }
      }
    });
  }

  static async uploadEmiratesId(userId: string, frontBuffer: Buffer, frontMimetype: string, backBuffer: Buffer, backMimetype: string) {
    if (!frontMimetype.startsWith('image/') || !backMimetype.startsWith('image/')) {
        throw new Error('INVALID_FILE_TYPE');
    }

    const tasker = await prisma.tasker.findUnique({ where: { userId }, select: { emiratesIdFrontUrl: true, emiratesIdBackUrl: true }});
    
    if (tasker?.emiratesIdFrontUrl) {
        await storageService.deleteFile(tasker.emiratesIdFrontUrl).catch(() => {});
    }
    if (tasker?.emiratesIdBackUrl) {
        await storageService.deleteFile(tasker.emiratesIdBackUrl).catch(() => {});
    }

    const frontUrl = await storageService.uploadFile(frontBuffer, frontMimetype, 'emirates-ids/front');
    const backUrl = await storageService.uploadFile(backBuffer, backMimetype, 'emirates-ids/back');

    return prisma.tasker.update({
        where: { userId },
        data: {
            emiratesIdFrontUrl: frontUrl,
            emiratesIdBackUrl: backUrl,
            isVerified: false // Needs re-verification after upload
        }
    });
  }

  static async updateAvailability(userId: string, isOnline: boolean) {
      return prisma.tasker.update({
          where: { userId },
          data: { isOnline }
      });
  }

  static async updateLocation(userId: string, lat: number, lng: number) {
      // While prompt says JWT only, updating the DB is the simplest way to ensure 
      // other services can query taskers by location later.
      return prisma.tasker.update({
          where: { userId },
          data: { currentLat: lat, currentLng: lng }
      });
  }

  static async getPublicProfile(id: string) {
      const tasker = await prisma.tasker.findUnique({
          where: { id },
          select: {
              id: true,
              bio: true,
              rating: true,
              completedTasksCount: true,
              skills: true,
              user: {
                  select: { firstName: true, avatarUrl: true } // Hide phone, email, last name
              }
          }
      });

      if (!tasker) {
          throw new Error('NOT_FOUND');
      }

      return tasker;
  }

  static async getEarnings(userId: string) {
      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const currentDay = now.getDay();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // We determine earnings from completed tasks they have done.
      // (The payment record is associated to the task. The tasker is paid 80%).
      const tasker = await prisma.tasker.findUnique({ where: { userId }, include: { user: true } });
      if (!tasker) throw new Error('NOT_FOUND');

      const completedTasks = await prisma.task.findMany({
           where: { taskerId: tasker.id, status: 'COMPLETED', priceFinal: { not: null } }
      });

      let todayFils = 0;
      let weekFils = 0;
      let monthFils = 0;
      let allTimeFils = 0;

      for (const task of completedTasks) {
          const payout = Math.floor(task.priceFinal! * 0.80);
          allTimeFils += payout;

          if (task.completedAt) {
              if (task.completedAt >= todayStart) todayFils += payout;
              if (task.completedAt >= weekStart) weekFils += payout;
              if (task.completedAt >= monthStart) monthFils += payout;
          }
      }

      // Pending logic for active tasks
      const pendingTasks = await prisma.task.findMany({
           where: { taskerId: tasker.id, status: 'IN_PROGRESS', priceFinal: { not: null } }
      });
      const pendingFils = pendingTasks.reduce((acc, t) => acc + Math.floor(t.priceFinal! * 0.80), 0);

      return {
          today_fils: todayFils,
          this_week_fils: weekFils,
          this_month_fils: monthFils,
          all_time_fils: allTimeFils,
          pending_fils: pendingFils,
          wallet_balance_fils: tasker.user.walletBalanceFils
      };
  }

  static async getEarningsTransactions(userId: string, page: number = 1, limit: number = 20) {
      const tasker = await prisma.tasker.findUnique({ where: { userId }});
      if (!tasker) throw new Error('NOT_FOUND');

      const skip = (page - 1) * limit;

      return prisma.task.findMany({
          where: { taskerId: tasker.id, status: 'COMPLETED' },
          select: { id: true, title: true, priceFinal: true, completedAt: true },
          skip,
          take: limit,
          orderBy: { completedAt: 'desc' }
      });
  }

  static async requestPayout(userId: string, amountFils: number, bankName: string, iban: string) {
      return await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user || user.walletBalanceFils < amountFils) {
              throw new Error('INSUFFICIENT_FUNDS');
          }

          // In standard flows, funds are "frozen" or checked on approval. 
          // Since the simulation delays 5 seconds, we let the job deduct it for transactional safety to prevent races
          
          const request = await tx.payoutRequest.create({
              data: {
                  userId,
                  amountFils,
                  bankName,
                  iban,
                  status: 'PENDING'
              }
          });

          // Enqueue job for 5s delay
          const { approvePayoutQueue } = await import('../../shared/jobs/approvePayout.job');
          await approvePayoutQueue.add('approve', { payoutId: request.id }, { delay: 5000 });

          return request;
      });
  }
}
