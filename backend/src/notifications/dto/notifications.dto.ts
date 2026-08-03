import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  read: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
