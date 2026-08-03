import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Le nom de la catégorie est requis.'),
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
