import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Détermine la boutique sur laquelle une requête doit opérer.
 * - Si `requestedStoreId` est fourni : vérifie qu'elle appartient au tenant et que
 *   l'utilisateur y a accès (ADMIN a accès à toutes les boutiques du tenant).
 * - Sinon : si l'utilisateur n'a accès qu'à une seule boutique, l'utilise automatiquement.
 *   S'il en a plusieurs (ou zéro, pour un non-ADMIN), une boutique explicite est requise.
 *
 * `allowAllStores` permet aux lectures agrégées ADMIN (dashboard, rapports) de renvoyer
 * `null` (= toutes les boutiques) quand aucune n'est précisée.
 */
export async function resolveActiveStoreId(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
  role: string,
  requestedStoreId?: string,
  allowAllStores = false,
): Promise<string | null> {
  if (requestedStoreId) {
    const store = await prisma.store.findFirst({ where: { id: requestedStoreId, tenantId } });
    if (!store) {
      throw new BadRequestException('Boutique introuvable dans cette organisation.');
    }
    if (role !== 'ADMIN') {
      const access = await prisma.userStore.findUnique({
        where: { userId_storeId: { userId, storeId: requestedStoreId } },
      });
      if (!access) {
        throw new ForbiddenException("Vous n'avez pas accès à cette boutique.");
      }
    }
    return store.id;
  }

  if (role === 'ADMIN') {
    if (allowAllStores) {
      return null;
    }
    // Un ADMIN qui écrit doit préciser la boutique — pas d'auto-sélection ambiguë.
    const stores = await prisma.store.findMany({ where: { tenantId }, select: { id: true } });
    if (stores.length === 1) {
      return stores[0].id;
    }
    throw new BadRequestException('Précisez la boutique concernée (storeId).');
  }

  const userStores = await prisma.userStore.findMany({ where: { userId } });
  if (userStores.length === 1) {
    return userStores[0].storeId;
  }
  if (userStores.length === 0) {
    throw new ForbiddenException("Vous n'êtes assigné à aucune boutique.");
  }
  throw new BadRequestException('Précisez la boutique concernée (storeId) : vous avez accès à plusieurs.');
}
