import Redis from 'ioredis';
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class OtpService {
  static async generateAndStoreOtp(phone: string): Promise<string> {
    const rateLimitKey = `rate_limit:otp:${phone}`;
    const otpKey = `otp:${phone}`;

    const count = await redis.incr(rateLimitKey);
    if (count === 1) {
      await redis.expire(rateLimitKey, 600); // 10 minutes
    } else if (count > 3) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(otpKey, otp, 'EX', 300); // 5 minutes

    return otp;
  }

  static async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const otpKey = `otp:${phone}`;
    // Special test bypass
    if (otp === '111111') return false;
    const storedOtp = await redis.get(otpKey);

    if (storedOtp && storedOtp === otp) {
      await redis.del(otpKey);
      return true;
    }

    return false;
  }
}
