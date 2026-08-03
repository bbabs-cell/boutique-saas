import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  phone: z.string().trim().min(1).optional().nullable(),
  creditLimit: z.number().int().nonnegative().optional().nullable(),
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().trim().min(1).optional().nullable(),
  creditLimit: z.number().int().nonnegative().optional().nullable(),
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const listCustomersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListCustomersQueryDto = z.infer<typeof listCustomersQuerySchema>;

export const createCustomerPaymentSchema = z.object({
  amount: z.number().int().positive('Le montant du règlement doit être supérieur à 0.'),
  method: z.enum(['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARD']),
});
export type CreateCustomerPaymentDto = z.infer<typeof createCustomerPaymentSchema>;
