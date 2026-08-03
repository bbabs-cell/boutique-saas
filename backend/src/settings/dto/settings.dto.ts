import { z } from 'zod';

export const updateSettingsSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.').optional(),
  currency: z.string().min(1).optional(),
  tvaEnabled: z.boolean().optional(),
  tvaRate: z.number().int().min(0).max(100).optional(),
  language: z.enum(['fr', 'en']).optional(),
});
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
