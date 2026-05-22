import { z } from 'zod';
import { TaskStatus } from '@prisma/client';

export const createTaskSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  location_lat: z.coerce.number(),
  location_lng: z.coerce.number(),
  location_address: z.string().min(1),
  scheduled_at: z.string().refine((val) => val === 'asap' || !isNaN(Date.parse(val)), {
    message: "Must be a valid ISO date or 'asap'",
  }),
  budget_fils: z.coerce.number().int().positive(),
  special_instructions: z.string().optional(),
  is_recurring: z.coerce.boolean().default(false),
});

export const filterTasksSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});

export const availableTasksSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius_km: z.coerce.number(),
  category_id: z.string().uuid().optional(),
});
