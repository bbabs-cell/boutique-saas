import { ForbiddenException } from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PlanLimits {
  maxStores: number | null; // null = illimité
  maxProducts: number | null;
  fineRoles: boolean; // MANAGER / MAGASINIER
  accounting: boolean; // Dépenses + Comptabilité
  publicApi: boolean;
}

// Paliers de départ — à ajuster selon le modèle tarifaire réel.
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: { maxStores: 1, maxProducts: 50, fineRoles: false, accounting: false, publicApi: false },
  STARTER: { maxStores: 3, maxProducts: null, fineRoles: true, accounting: false, publicApi: false },
  BUSINESS: { maxStores: null, maxProducts: null, fineRoles: true, accounting: true, publicApi: false },
  PREMIUM: { maxStores: null, maxProducts: null, fineRoles: true, accounting: true, publicApi: true },
};

// Tarifs mensuels indicatifs, en FCFA — à ajuster selon le modèle tarifaire réel.
export const PLAN_PRICES: Record<PlanTier, number> = {
  FREE: 0,
  STARTER: 15000,
  BUSINESS: 35000,
  PREMIUM: 60000,
};

export type PlanResource = 'stores' | 'products';
export type PlanFeature = 'fineRoles' | 'accounting' | 'publicApi';

/** Récupère l'abonnement du tenant, en créant un abonnement Gratuit par défaut s'il n'en a pas encore. */
export async function getOrCreateSubscription(prisma: PrismaService, tenantId: string) {
  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.subscription.create({ data: { tenantId } });
}

export async function getTenantPlanLimits(prisma: PrismaService, tenantId: string): Promise<PlanLimits> {
  const subscription = await getOrCreateSubscription(prisma, tenantId);
  return PLAN_LIMITS[subscription.plan];
}

/** Lève une ForbiddenException si créer une ressource de plus dépasserait la limite du plan. */
export async function assertWithinResourceLimit(
  prisma: PrismaService,
  tenantId: string,
  resource: PlanResource,
): Promise<void> {
  const limits = await getTenantPlanLimits(prisma, tenantId);
  const max = resource === 'stores' ? limits.maxStores : limits.maxProducts;
  if (max === null) return; // illimité sur ce plan

  const current =
    resource === 'stores'
      ? await prisma.store.count({ where: { tenantId } })
      : await prisma.product.count({ where: { tenantId, active: true } });

  if (current >= max) {
    const label = resource === 'stores' ? 'boutiques' : 'produits';
    throw new ForbiddenException(
      `Votre plan actuel est limité à ${max} ${label}. Passez à un plan supérieur pour continuer.`,
    );
  }
}

/** Lève une ForbiddenException si la fonctionnalité n'est pas incluse dans le plan du tenant. */
export async function assertPlanFeature(
  prisma: PrismaService,
  tenantId: string,
  feature: PlanFeature,
): Promise<void> {
  const limits = await getTenantPlanLimits(prisma, tenantId);
  if (!limits[feature]) {
    throw new ForbiddenException(
      "Cette fonctionnalité n'est pas incluse dans votre plan actuel. Passez à un plan supérieur pour y accéder.",
    );
  }
}
