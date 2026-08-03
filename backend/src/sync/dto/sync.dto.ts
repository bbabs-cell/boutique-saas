import { z } from 'zod';
import { paymentSchema, saleItemSchema } from '../../sales/dto/sales.dto';

export const bootstrapQuerySchema = z.object({
  storeId: z.string().optional(),
});
export type BootstrapQueryDto = z.infer<typeof bootstrapQuerySchema>;

export const offlineSaleSchema = z.object({
  // Généré côté client (ex. UUID) à la création de la vente hors-ligne — jamais par le serveur.
  clientSaleId: z.string().min(1, 'clientSaleId est requis pour chaque vente hors-ligne.'),
  items: z.array(saleItemSchema).min(1, 'Le panier ne peut pas être vide.'),
  discount: z.number().int().nonnegative().default(0),
  payments: z.array(paymentSchema).min(1, 'Au moins un paiement est requis.'),
  customerId: z.string().min(1).optional().nullable(),
  // Contrairement à la caisse en ligne, la boutique est toujours explicite hors-ligne :
  // le mode dégradé ne doit jamais avoir à deviner ou interroger le serveur pour la déterminer.
  storeId: z.string().min(1, 'storeId est requis pour une vente hors-ligne.'),
  // Horodatage client, informatif uniquement (la date de création serveur reste la source de vérité).
  createdOfflineAt: z.string().datetime().optional(),
});
export type OfflineSaleDto = z.infer<typeof offlineSaleSchema>;

export const syncSalesBatchSchema = z.object({
  sales: z.array(offlineSaleSchema).min(1, 'Le lot de synchronisation ne peut pas être vide.'),
});
export type SyncSalesBatchDto = z.infer<typeof syncSalesBatchSchema>;
