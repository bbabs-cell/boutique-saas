import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
});
export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;
