import { z } from 'zod';

export const WEBHOOK_EVENTS = ['sale.created', 'stock.low'] as const;

export const createWebhookSchema = z.object({
  url: z.string().url('URL invalide.'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Sélectionnez au moins un événement.'),
});
export type CreateWebhookDto = z.infer<typeof createWebhookSchema>;
