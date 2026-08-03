import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  role: z.enum(['ADMIN', 'MANAGER', 'CAISSIER', 'MAGASINIER']).default('CAISSIER'),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  active: z.boolean(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
