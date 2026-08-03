import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive('La quantité doit être supérieure à 0.'),
});

export const paymentSchema = z.object({
  method: z.enum(['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARD', 'CREDIT']),
  amount: z.number().int().positive('Le montant du paiement doit être supérieur à 0.'),
  reference: z.string().trim().min(1).optional().nullable(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Le panier ne peut pas être vide.'),
  discount: z.number().int().nonnegative('La remise doit être positive ou nulle.').default(0),
  payments: z.array(paymentSchema).min(1, 'Au moins un paiement est requis.'),
  customerId: z.string().min(1).optional().nullable(),
  storeId: z.string().optional(),
  // Renseigné uniquement pour une vente rejouée depuis le mode hors-ligne (Sprint 12) :
  // permet la déduplication si le même lot est resynchronisé deux fois.
  clientId: z.string().optional(),
});
export type CreateSaleDto = z.infer<typeof createSaleSchema>;

export const listSalesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  userId: z.string().optional(),
  storeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListSalesQueryDto = z.infer<typeof listSalesQuerySchema>;
