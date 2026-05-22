import { PrismaClient, TaskStatus } from '@prisma/client';
import { StorageService } from '../../shared/services/storage.service';
import { matchTaskQueue } from '../../shared/jobs/matchTask.job';
import { emitTaskStatusChanged } from '../messaging/socket.gateway';

const prisma = new PrismaClient();
const storageService = new StorageService();

export class TasksService {
  static async createTask(customerId: string, data: any, photoBuffers: {buffer: Buffer, mimetype: string}[]) {
    if (photoBuffers.length > 5) {
        throw new Error('MAX_PHOTOS_EXCEEDED');
    }

    const photoUrls = [];
    for (const photo of photoBuffers) {
        if (!photo.mimetype.startsWith('image/')) {
            throw new Error('INVALID_FILE_TYPE');
        }
        if (photo.buffer.length > 5 * 1024 * 1024) {
            throw new Error('FILE_TOO_LARGE');
        }
        const url = await storageService.uploadFile(photo.buffer, photo.mimetype, 'tasks');
        photoUrls.push(url);
    }

    let scheduledAt = null;
    if (data.scheduled_at !== 'asap') {
        scheduledAt = new Date(data.scheduled_at);
    }

    const task = await prisma.task.create({
        data: {
            customerId,
            categoryId: data.category_id,
            title: data.title,
            description: data.description,
            locationLat: data.location_lat,
            locationLng: data.location_lng,
            locationAddress: data.location_address,
            scheduledAt,
            budgetFils: data.budget_fils,
            photos: photoUrls,
            specialInstructions: data.special_instructions,
            isRecurring: data.is_recurring,
            status: 'PENDING'
        }
    });

    await matchTaskQueue.add('match', {
        taskId: task.id,
        lat: task.locationLat,
        lng: task.locationLng,
        categoryId: task.categoryId
    });

    emitTaskStatusChanged(task.id, 'PENDING', 'Task was created.');
    return task;
  }

  static async getCustomerTasks(customerId: string, status?: TaskStatus, page: number = 1, limit: number = 10) {
      const skip = (page - 1) * limit;
      const where = { customerId, ...(status ? { status } : {}) };

      const [tasks, total] = await Promise.all([
          prisma.task.findMany({
              where,
              skip,
              take: limit,
              orderBy: { createdAt: 'desc' },
              include: { category: true }
          }),
          prisma.task.count({ where })
      ]);

      return { tasks, total, page, limit };
  }

  static async getTaskDetail(id: string, userId: string, role: string) {
      const task = await prisma.task.findUnique({
          where: { id },
          include: { category: true, customer: { select: { firstName: true, avatarUrl: true }}, tasker: { select: { rating: true, user: { select: { firstName: true, avatarUrl: true }}}} }
      });

      if (!task) throw new Error('NOT_FOUND');

      // Taskers can view public pending tasks, otherwise must be assigned to them
      if (role === 'TASKER' && task.status !== 'PENDING' && task.tasker?.user.id !== userId) {
           throw new Error('NOT_FOUND');
      }

      if (role === 'CUSTOMER' && task.customerId !== userId) {
           throw new Error('NOT_FOUND');
      }

      return task;
  }

  static async cancelTask(id: string, customerId: string) {
      const task = await prisma.task.findUnique({ where: { id }, include: { tasker: true } });
      
      if (!task || task.customerId !== customerId) {
          throw new Error('NOT_FOUND');
      }

      if (task.status !== 'PENDING' && task.status !== 'ACCEPTED') {
          throw new Error('INVALID_STATUS');
      }

      // Cancellation logic
      if (task.status === 'ACCEPTED' && task.taskerId && task.updatedAt) {
          const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
          if (task.updatedAt < tenMinsAgo) {
              // Charge 10 AED fee
              await prisma.walletTransaction.create({
                  data: {
                      userId: customerId,
                      amountFils: -10000,
                      description: `Cancellation fee for task ${task.id}`
                  }
              });
              console.log(`Cancellation fee applied for task ${task.id} to user ${customerId}`);
          }
          console.log(`Notifying tasker ${task.taskerId} about cancellation of task ${task.id}`);
      }

      const updated = await prisma.task.update({
          where: { id },
          data: { status: 'CANCELLED' }
      });

      emitTaskStatusChanged(id, 'CANCELLED', 'Task was cancelled.');
      return updated;
  }

  static async getAvailableTasks(taskerId: string, lat: number, lng: number, radiusKm: number, categoryId?: string) {
      const tasker = await prisma.tasker.findUnique({ where: { userId: taskerId }, include: { bids: true } });
      if (!tasker) throw new Error('NOT_FOUND');

      const bidTaskIds = tasker.bids.map(b => b.taskId);

      const tasks = await prisma.task.findMany({
          where: {
              status: 'PENDING',
              id: { notIn: bidTaskIds },
              ...(categoryId ? { categoryId } : {})
          },
          include: { category: true }
      });

      // Filter and sort by distance using Haversine
      const getDistanceFromLatLonInKm = function(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; 
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
      }
      const deg2rad = function(deg: number) { return deg * (Math.PI / 180); }

      const mappedTasks = tasks.map(task => {
          const distance = getDistanceFromLatLonInKm(lat, lng, task.locationLat, task.locationLng);
          return { ...task, distance };
      });

      const availableTasks = mappedTasks.filter(t => t.distance <= radiusKm).sort((a, b) => a.distance - b.distance);

      return availableTasks;
  }

  static async placeBid(taskId: string, userId: string, data: any) {
      const tasker = await prisma.tasker.findUnique({ where: { userId }});
      if (!tasker || !tasker.isVerified || !tasker.isOnline) {
          throw new Error('UNAUTHORIZED_TASKER');
      }

      const task = await prisma.task.findUnique({ where: { id: taskId }, include: { bids: true }});
      if (!task) throw new Error('NOT_FOUND');
      
      if (task.status !== 'PENDING') throw new Error('INVALID_STATUS');
      if (task.customerId === userId) throw new Error('CANNOT_BID_OWN_TASK');

      if (task.bids.length >= 10) throw new Error('MAX_BIDS_REACHED');
      
      const existingBid = task.bids.find(b => b.taskerId === tasker.id);
      if (existingBid) throw new Error('DUPLICATE_BID');

      const bid = await prisma.bid.create({
          data: {
              taskId,
              taskerId: tasker.id,
              amountFils: data.amount_fils,
              message: data.message,
              etaMinutes: data.eta_minutes
          }
      });

      console.log(`New bid on task ${taskId} from tasker ${tasker.id}: AED ${data.amount_fils / 100}`);

      return bid;
  }

  static async getBids(taskId: string, customerId: string) {
      const task = await prisma.task.findUnique({ where: { id: taskId }});
      if (!task || task.customerId !== customerId) throw new Error('NOT_FOUND');

      const bids = await prisma.bid.findMany({
          where: { taskId },
          include: {
              tasker: {
                  include: {
                      user: { select: { firstName: true, avatarUrl: true }}
                  }
              }
          }
      });

      // Simple haversine inline since we don't store distance on bid
      const R = 6371; 
      const deg2rad = (deg: number) => deg * (Math.PI / 180);

      return bids.map(bid => {
          let distance = null;
          if (bid.tasker.currentLat && bid.tasker.currentLng) {
             const dLat = deg2rad(bid.tasker.currentLat - task.locationLat);
             const dLon = deg2rad(bid.tasker.currentLng - task.locationLng);
             const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(task.locationLat)) * Math.cos(deg2rad(bid.tasker.currentLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
             const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
             distance = R * c; 
          }
          return {
              id: bid.id,
              amountFils: bid.amountFils,
              message: bid.message,
              etaMinutes: bid.etaMinutes,
              status: bid.status,
              createdAt: bid.createdAt,
              tasker: {
                  id: bid.tasker.id,
                  firstName: bid.tasker.user.firstName,
                  avatarUrl: bid.tasker.user.avatarUrl,
                  rating: bid.tasker.rating,
                  completedTasksCount: bid.tasker.completedTasksCount,
                  distance
              }
          };
      });
  }

  static async acceptBid(taskId: string, bidId: string, customerId: string) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.customerId !== customerId) throw new Error('NOT_FOUND');
      if (task.status !== 'PENDING') throw new Error('INVALID_STATUS');

      const bid = await prisma.bid.findUnique({ where: { id: bidId } });
      if (!bid || bid.taskId !== taskId) throw new Error('NOT_FOUND');

      const updatedTask = await prisma.$transaction(async (tx) => {
          const uTask = await tx.task.update({
              where: { id: taskId },
              data: {
                  status: 'ACCEPTED',
                  taskerId: bid.taskerId,
                  priceFinal: bid.amountFils
              }
          });

          await tx.bid.update({
              where: { id: bidId },
              data: { status: 'ACCEPTED' }
          });

          await tx.bid.updateMany({
              where: { taskId, id: { not: bidId } },
              data: { status: 'REJECTED' }
          });

          // Simulated payment record
          await tx.payment.create({
              data: {
                  taskId,
                  customerId,
                  amountFils: bid.amountFils,
                  status: 'PENDING', // Reserved state conceptually before capture
              }
          });

          emitTaskStatusChanged(taskId, 'ACCEPTED', 'Task was accepted.');
          emitTaskStatusChanged(taskId, 'ACCEPTED', 'Task was accepted.');
          return uTask;
      });

      console.log(`Bid ${bidId} accepted for task ${taskId}. Notifying winner and rejected taskers.`);
      return updatedTask;
  }

  static async withdrawBid(taskId: string, bidId: string, userId: string) {
      const tasker = await prisma.tasker.findUnique({ where: { userId }});
      if (!tasker) throw new Error('NOT_FOUND');

      const bid = await prisma.bid.findUnique({ where: { id: bidId }});
      if (!bid || bid.taskId !== taskId || bid.taskerId !== tasker.id) throw new Error('NOT_FOUND');

      if (bid.status !== 'PENDING') throw new Error('INVALID_STATUS');

      await prisma.bid.delete({ where: { id: bidId } });
      return true;
  }

  static async startTask(taskId: string, userId: string) {
      const tasker = await prisma.tasker.findUnique({ where: { userId }});
      if (!tasker) throw new Error('NOT_FOUND');

      const task = await prisma.task.findUnique({ where: { id: taskId }});
      if (!task || task.taskerId !== tasker.id) throw new Error('NOT_FOUND');

      if (task.status !== 'ACCEPTED') throw new Error('INVALID_STATUS');

      const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: { status: 'IN_PROGRESS', startedAt: new Date() }
      });

      console.log(`Task ${taskId} started by tasker ${tasker.id}. Notifying customer.`);
      return updatedTask;
  }

  static async completeTask(taskId: string, userId: string, data: any, photoBuffers: {buffer: Buffer, mimetype: string}[]) {
      const tasker = await prisma.tasker.findUnique({ where: { userId }});
      if (!tasker) throw new Error('NOT_FOUND');

      const task = await prisma.task.findUnique({ where: { id: taskId }});
      if (!task || task.taskerId !== tasker.id) throw new Error('NOT_FOUND');

      if (task.status !== 'IN_PROGRESS') throw new Error('INVALID_STATUS');

      if (photoBuffers.length < 1 || photoBuffers.length > 3) {
          throw new Error('INVALID_PHOTOS_COUNT');
      }

      const photoUrls = [];
      for (const photo of photoBuffers) {
          if (!photo.mimetype.startsWith('image/')) throw new Error('INVALID_FILE_TYPE');
          const url = await storageService.uploadFile(photo.buffer, photo.mimetype, 'tasks/completion');
          photoUrls.push(url);
      }

      const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              completionNotes: data.completion_notes,
              completionPhotos: photoUrls
          }
      });

      console.log(`Task ${taskId} completed by tasker ${tasker.id}. Triggering payment release.`);
      
      const { releasePaymentQueue } = await import('../../shared/jobs/releasePayment.job');
      await releasePaymentQueue.add('release', { taskId: updatedTask.id });

      return updatedTask;
  }
}
