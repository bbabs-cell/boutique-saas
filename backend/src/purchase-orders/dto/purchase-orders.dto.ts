import { z } from 'zod';

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive('La quantité doit être supérieure à 0.'),
  unitCost: z.number().int().nonnegative('Le coût doit être positif.'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Un fournisseur est requis.'),
  items: z.array(purchaseOrderItemSchema).min(1, 'La commande doit contenir au moins une ligne.'),
  status: z.enum(['DRAFT', 'ORDERED']).default('DRAFT'),
  storeId: z.string().optional(),
});
export type CreatePurchaseOrderDto = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1).optional(),
  items: z.array(purchaseOrderItemSchema).min(1).optional(),
  status: z.enum(['DRAFT', 'ORDERED', 'CANCELLED']).optional(),
});
export type UpdatePurchaseOrderDto = z.infer<typeof updatePurchaseOrderSchema>;

export const listPurchaseOrdersQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).optional(),
  supplierId: z.string().optional(),
  storeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListPurchaseOrdersQueryDto = z.infer<typeof listPurchaseOrdersQuerySchema>;
