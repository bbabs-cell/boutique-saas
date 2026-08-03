import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  phone: z.string().trim().min(1).optional().nullable(),
});
export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().trim().min(1).optional().nullable(),
});
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;

export const listSuppliersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListSuppliersQueryDto = z.infer<typeof listSuppliersQuerySchema>;

export const createSupplierPaymentSchema = z.object({
  amount: z.number().int().positive('Le montant du règlement doit être supérieur à 0.'),
  method: z.enum(['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARD']),
});
export type CreateSupplierPaymentDto = z.infer<typeof createSupplierPaymentSchema>;
