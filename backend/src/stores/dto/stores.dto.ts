import { z } from 'zod';

export const createStoreSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  address: z.string().trim().min(1).optional().nullable(),
});
export type CreateStoreDto = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().trim().min(1).optional().nullable(),
});
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;

export const assignUserSchema = z.object({
  userId: z.string().min(1),
});
export type AssignUserDto = z.infer<typeof assignUserSchema>;
