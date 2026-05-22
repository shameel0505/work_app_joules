import { z } from 'zod';

export const topupSchema = z.object({
  amount_fils: z.number().int().min(5000).max(500000)
});

export const paginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});
