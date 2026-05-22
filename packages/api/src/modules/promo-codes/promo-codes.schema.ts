import { z } from 'zod';

export const validatePromoSchema = z.object({
  code: z.string().min(1),
  task_price_fils: z.number().int().positive()
});
