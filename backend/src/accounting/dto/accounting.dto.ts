import { z } from 'zod';

export const accountingSummaryQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'year', 'custom']).default('month'),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .refine((data) => data.period !== 'custom' || (data.from && data.to), {
    message: 'Les dates "from" et "to" sont requises pour une période personnalisée.',
    path: ['from'],
  });
export type AccountingSummaryQueryDto = z.infer<typeof accountingSummaryQuerySchema>;
