import { PrismaClient, TaskStatus } from '@prisma/client';
import { StorageService } from '../../shared/services/storage.service';
import { matchTaskQueue } from '../../shared/jobs/matchTask.job';

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

      return prisma.task.update({
          where: { id },
          data: { status: 'CANCELLED' }
      });
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
      function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; 
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
      }
      function deg2rad(deg: number) { return deg * (Math.PI / 180); }

      const mappedTasks = tasks.map(task => {
          const distance = getDistanceFromLatLonInKm(lat, lng, task.locationLat, task.locationLng);
          return { ...task, distance };
      });

      const availableTasks = mappedTasks.filter(t => t.distance <= radiusKm).sort((a, b) => a.distance - b.distance);

      return availableTasks;
  }
}
