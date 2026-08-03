import { z } from 'zod';

export const salesReportQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'year', 'custom']).default('month'),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    userId: z.string().optional(),
    productId: z.string().optional(),
    categoryId: z.string().optional(),
    storeId: z.string().optional(),
  })
  .refine((data) => data.period !== 'custom' || (data.from && data.to), {
    message: 'Les dates "from" et "to" sont requises pour une période personnalisée.',
    path: ['from'],
  });
export type SalesReportQueryDto = z.infer<typeof salesReportQuerySchema>;
