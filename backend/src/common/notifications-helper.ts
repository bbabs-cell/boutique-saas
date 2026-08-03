import { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface ProductStockInfo {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number | null;
}

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
    await tx.notification.create({
      data: {
        tenantId,
        userId: null,
        type: 'OUT_OF_STOCK',
        message: `Rupture de stock : « ${product.name} ».`,
      },
    });
    return;
  }

  if (product.lowStockThreshold !== null && product.stock <= product.lowStockThreshold) {
    await tx.notification.create({
      data: {
        tenantId,
        userId: null,
        type: 'LOW_STOCK',
        message: `Stock faible pour « ${product.name} » (${product.stock} restant${product.stock > 1 ? 's' : ''}, seuil ${product.lowStockThreshold}).`,
      },
    });
  }
}

export type { TransactionClient };
