import { z } from 'zod';

export const createStockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z
    .number()
    .int()
    .refine((v) => v !== 0, 'La quantité ajustée ne peut pas être nulle.'),
  reason: z.string().trim().min(1).optional().nullable(),
  storeId: z.string().optional(),
});
export type CreateStockAdjustmentDto = z.infer<typeof createStockAdjustmentSchema>;

export const listStockMovementsQuerySchema = z.object({
  productId: z.string().optional(),
  type: z.enum(['SALE', 'ADJUSTMENT', 'RESTOCK']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  storeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListStockMovementsQueryDto = z.infer<typeof listStockMovementsQuerySchema>;
