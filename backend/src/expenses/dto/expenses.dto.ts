import { z } from 'zod';

export const createExpenseSchema = z.object({
  label: z.string().min(1, "Le libellé de la dépense est requis."),
  amount: z.number().int().positive('Le montant doit être supérieur à 0.'),
  category: z.string().trim().min(1).optional().nullable(),
});
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;

export const listExpensesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListExpensesQueryDto = z.infer<typeof listExpensesQuerySchema>;
