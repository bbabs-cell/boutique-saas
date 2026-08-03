import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Le nom du produit est requis.'),
  barcode: z.string().trim().min(1).optional().nullable(),
  price: z.number().int().nonnegative('Le prix doit être positif.'),
  cost: z.number().int().nonnegative('Le coût doit être positif.'),
  stock: z.number().int().nonnegative('Le stock doit être positif.').default(0),
  lowStockThreshold: z.number().int().nonnegative('Le seuil doit être positif.').optional().nullable(),
  categoryId: z.string().optional().nullable(),
  storeId: z.string().optional(),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  storeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;
