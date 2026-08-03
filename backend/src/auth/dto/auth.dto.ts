import { z } from 'zod';

export const registerSchema = z.object({
  shopName: z.string().min(2, 'Le nom de la boutique doit contenir au moins 2 caractères.'),
  adminName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
  code: z.string().trim().min(1).optional(),
});
export type LoginDto = z.infer<typeof loginSchema>;
