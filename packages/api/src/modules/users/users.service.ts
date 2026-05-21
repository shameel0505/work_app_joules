import { PrismaClient } from '@prisma/client';
import { StorageService } from '../../shared/services/storage.service';
import sharp from 'sharp';

const prisma = new PrismaClient();
const storageService = new StorageService();

export class UsersService {
  static async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, avatarUrl: true, preferredLang: true, createdAt: true
      }
    });
  }

  static async updateProfile(userId: string, data: any) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, avatarUrl: true, preferredLang: true, createdAt: true
      }
    });
  }

  static async uploadAvatar(userId: string, fileBuffer: Buffer, mimetype: string) {
    if (!mimetype.startsWith('image/')) {
        throw new Error('INVALID_FILE_TYPE');
    }

    const resizedBuffer = await sharp(fileBuffer)
        .resize(400, 400, { fit: 'cover' })
        .toBuffer();

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true }});
    if (user?.avatarUrl) {
        await storageService.deleteFile(user.avatarUrl).catch(() => {}); // Best effort delete
    }

    const avatarUrl = await storageService.uploadFile(resizedBuffer, mimetype, 'avatars');

    return prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
        select: { id: true, avatarUrl: true }
    });
  }

  static async getAddresses(userId: string) {
      return prisma.savedAddress.findMany({
          where: { userId }
      });
  }

  static async createAddress(userId: string, data: any) {
      return prisma.savedAddress.create({
          data: {
              ...data,
              userId
          }
      });
  }

  static async deleteAddress(userId: string, addressId: string) {
      const address = await prisma.savedAddress.findUnique({ where: { id: addressId } });
      if (!address || address.userId !== userId) {
          throw new Error('NOT_FOUND');
      }

      await prisma.savedAddress.delete({ where: { id: addressId }});
      return true;
  }
}
