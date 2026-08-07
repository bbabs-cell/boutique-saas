import { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface ProductStockInfo {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number | null;
}

/**
 * Fenêtre de silence entre deux notifications identiques pour le même produit.
 * Sans elle, un article populaire passé sous son seuil génère une notification à chaque vente :
 * la cloche se remplit de doublons et devient inutilisable — donc ignorée, ce qui fait perdre
 * l'alerte au moment où elle compte. Un jour est l'ordre de grandeur d'un réassort.
 */
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Crée une notification LOW_STOCK ou OUT_OF_STOCK si le niveau de stock du produit
 * le justifie, juste après qu'un mouvement de stock a été appliqué.
 * Visible par tous les admins du tenant (userId = null).
 */
export async function notifyStockLevel(
  tx: TransactionClient,
  tenantId: string,
  product: ProductStockInfo,
): Promise<void> {
  if (product.stock <= 0) {
    await createUnlessRecent(
      tx,
      tenantId,
      'OUT_OF_STOCK',
      product.name,
      `Rupture de stock : « ${product.name} ».`,
    );
    return;
  }

  if (product.lowStockThreshold !== null && product.stock <= product.lowStockThreshold) {
    await createUnlessRecent(
      tx,
      tenantId,
      'LOW_STOCK',
      product.name,
      `Stock faible pour « ${product.name} » (${product.stock} restant${product.stock > 1 ? 's' : ''}, seuil ${product.lowStockThreshold}).`,
    );
  }
}

/**
 * Le nom du produit sert de clé de déduplication : il apparaît dans le message, et le modèle
 * Notification ne porte pas de référence au produit. C'est imparfait (deux produits homonymes
 * se dédupliqueraient l'un l'autre) mais suffisant tant que le schéma ne relie pas les deux —
 * et infiniment préférable à une notification par vente.
 */
async function createUnlessRecent(
  tx: TransactionClient,
  tenantId: string,
  type: 'LOW_STOCK' | 'OUT_OF_STOCK',
  productName: string,
  message: string,
): Promise<void> {
  const recent = await tx.notification.findFirst({
    where: {
      tenantId,
      type,
      message: { contains: `« ${productName} »` },
      createdAt: { gte: new Date(Date.now() - NOTIFICATION_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    return;
  }

  await tx.notification.create({ data: { tenantId, userId: null, type, message } });
}

export { NOTIFICATION_COOLDOWN_MS };

export type { TransactionClient };
