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
