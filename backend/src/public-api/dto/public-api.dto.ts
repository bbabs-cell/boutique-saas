import { z } from 'zod';

export const publicPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type PublicPaginationQueryDto = z.infer<typeof publicPaginationQuerySchema>;
