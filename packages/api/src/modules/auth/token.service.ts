import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class TokenService {
  static async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  static async validateAndRotateRefreshToken(token: string): Promise<{ userId: string; newRefreshToken: string } | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return null;
    }

    // Rotate token (delete old, create new)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    
    const newRefreshToken = await this.generateRefreshToken(storedToken.userId);
    
    return { userId: storedToken.userId, newRefreshToken };
  }

  static async invalidateRefreshToken(token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }
}
