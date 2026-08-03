import { z } from 'zod';

export const topProductsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  storeId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type TopProductsQueryDto = z.infer<typeof topProductsQuerySchema>;

export const recentActivityQuerySchema = z.object({
  storeId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type RecentActivityQueryDto = z.infer<typeof recentActivityQuerySchema>;
