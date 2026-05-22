import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  task_id: z.string().uuid(),
  payment_method: z.enum(['card', 'wallet']),
  promo_code: z.string().optional()
});
