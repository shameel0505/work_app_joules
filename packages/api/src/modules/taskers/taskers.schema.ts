import { z } from 'zod';

export const updateTaskerSchema = z.object({
  bio: z.string().optional(),
  serviceRadiusKm: z.number().positive().optional(),
  hourlyRateFils: z.number().positive().int().optional(),
  skills: z.array(z.string()).optional(),
});

export const updateAvailabilitySchema = z.object({
  isOnline: z.boolean(),
});

export const updateLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const payoutRequestSchema = z.object({
  amount_fils: z.number().int().min(10000), // Min AED 100
  bank_name: z.string().min(1),
  iban: z.string().min(1)
});

export const earningsPaginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});
