import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { FastifyInstance } from 'fastify';

const prisma = new PrismaClient();

export class AuthService {
  static async sendOtp(phone: string) {
    try {
      const otp = await OtpService.generateAndStoreOtp(phone);
      return { success: true, otp };
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        return { success: false, error: 'RATE_LIMIT_EXCEEDED' };
      }
      throw error;
    }
  }

  static async verifyOtp(app: FastifyInstance, phone: string, otp: string, user_type: 'customer' | 'tasker') {
    const isValid = await OtpService.verifyOtp(phone, otp);
    if (!isValid) {
      return { success: false, error: 'INVALID_OTP' };
    }

    let user = await prisma.user.findUnique({
      where: { phone },
      include: { tasker: true },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const role = user_type === 'tasker' ? 'TASKER' : 'CUSTOMER';
      user = await prisma.user.create({
        data: {
          phone,
          email: `${phone}@temp.aidea.ae`, // Temp email required by schema
          firstName: 'New',
          lastName: 'User',
          role,
        },
        include: { tasker: true }
      });
    }

    if (user_type === 'tasker' && !user.tasker) {
       await prisma.tasker.create({
         data: {
           userId: user.id,
         }
       });
       user = await prisma.user.findUnique({ where: { id: user.id }, include: { tasker: true } }) as any;
    }

    const payload = { id: user.id, role: user.role };
    const accessToken = app.jwt.sign(payload, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
    const refreshToken = await TokenService.generateRefreshToken(user.id);

    return { success: true, data: { access_token: accessToken, refresh_token: refreshToken, user, is_new_user: isNewUser } };
  }

  static async adminLogin(app: FastifyInstance, email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.role !== 'ADMIN' || !user.password) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const payload = { id: user.id, role: user.role };
    const accessToken = app.jwt.sign(payload, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
    const refreshToken = await TokenService.generateRefreshToken(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return { 
      success: true, 
      data: { 
        access_token: accessToken, 
        refresh_token: refreshToken, 
        user: userWithoutPassword 
      } 
    };
  }
}
