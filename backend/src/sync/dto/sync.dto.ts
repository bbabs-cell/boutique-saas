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

/**
 * Chaque vente du lot est rejouée séquentiellement, dans sa propre transaction. Un lot sans
 * plafond peut donc dépasser le délai d'attente de n'importe quel proxy avant d'avoir fini —
 * et le client, ne recevant pas de réponse, retente le même lot indéfiniment.
 * Le client découpe ses ventes en attente en lots de cette taille et les envoie à la suite ;
 * la déduplication par `clientSaleId` rend l'opération sûre à répéter.
 */
export const MAX_SALES_PER_SYNC_BATCH = 50;

export const syncSalesBatchSchema = z.object({
  sales: z
    .array(offlineSaleSchema)
    .min(1, 'Le lot de synchronisation ne peut pas être vide.')
    .max(
      MAX_SALES_PER_SYNC_BATCH,
      `Un lot de synchronisation est limité à ${MAX_SALES_PER_SYNC_BATCH} ventes. Envoyez-les en plusieurs lots.`,
    ),
});
export type SyncSalesBatchDto = z.infer<typeof syncSalesBatchSchema>;
