import { z } from 'zod';

export const upgradeSubscriptionSchema = z.object({
  plan: z.enum(['FREE', 'STARTER', 'BUSINESS', 'PREMIUM']),
  method: z.enum(['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARD']).optional(),
  reference: z.string().trim().min(1).optional().nullable(),
});
export type UpgradeSubscriptionDto = z.infer<typeof upgradeSubscriptionSchema>;
