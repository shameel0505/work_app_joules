import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema, adminLoginSchema } from './auth.schema';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

export class AuthController {
  static async sendOtp(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { phone } = sendOtpSchema.parse(request.body);
      const result = await AuthService.sendOtp(phone);
      
      if (!result.success) {
        if (result.error === 'RATE_LIMIT_EXCEEDED') {
            return reply.status(429).send({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again later.' }});
        }
        return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Could not send OTP' } });
      }

      const isDevMode = process.env.OTP_DEV_MODE === 'true';
      const responseData: any = { expires_in: 300 };
      
      if (isDevMode) {
        responseData.otp = result.otp;
      }

      return reply.send({ success: true, data: responseData });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
        }
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }

  static async verifyOtp(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
    try {
      const { phone, otp, user_type } = verifyOtpSchema.parse(request.body);
      const result = await AuthService.verifyOtp(app, phone, otp, user_type);

      if (!result.success) {
        if (result.error === 'INVALID_OTP') {
           return reply.status(401).send({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' } });
        }
        return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Could not verify OTP' } });
      }

      return reply.send({ success: true, data: result.data });
    } catch (error: any) {
       if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
       }
       return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }

  static async refresh(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        const { refresh_token } = refreshTokenSchema.parse(request.body);
        const result = await TokenService.validateAndRotateRefreshToken(refresh_token);

        if (!result) {
             return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } });
        }

        const payload = { id: result.userId, role: 'CUSTOMER' }; // A real app would query the DB for the role
        const access_token = app.jwt.sign(payload, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });

        return reply.send({ success: true, data: { access_token, refresh_token: result.newRefreshToken }});

      } catch (error: any) {
        if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
        }
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
      }
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { refresh_token } = refreshTokenSchema.parse(request.body);
        await TokenService.invalidateRefreshToken(refresh_token);
        
        return reply.send({ success: true, data: null });
      } catch (error: any) {
         if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
         }
         return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
      }
  }

  static async adminLogin(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        const { email, password } = adminLoginSchema.parse(request.body);
        const result = await AuthService.adminLogin(app, email, password);

        if (!result || !result.success) {
            return reply.status(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        }

        return reply.send({ success: true, data: result.data });

      } catch (error: any) {
         if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
         }
         return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
      }
  }
}
