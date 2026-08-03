import { z } from 'zod';

export const verifyTwoFactorSchema = z.object({
  code: z.string().trim().min(6, 'Le code doit contenir 6 chiffres.').max(6),
});
export type VerifyTwoFactorDto = z.infer<typeof verifyTwoFactorSchema>;

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Votre mot de passe est requis pour désactiver le 2FA.'),
});
export type DisableTwoFactorDto = z.infer<typeof disableTwoFactorSchema>;
