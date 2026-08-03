import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;
