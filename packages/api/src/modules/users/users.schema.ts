import { z } from 'zod';

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  preferredLang: z.enum(['en', 'ar']).optional(),
});

export const createAddressSchema = z.object({
  title: z.string().min(1),
  formattedAddress: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});
