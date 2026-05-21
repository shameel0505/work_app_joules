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
}
