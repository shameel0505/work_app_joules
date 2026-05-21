import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+971\d{9}$/, 'Phone must be in +971XXXXXXXXX format'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+971\d{9}$/, 'Phone must be in +971XXXXXXXXX format'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  user_type: z.enum(['customer', 'tasker']),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
