import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import {
  assertPlanFeature,
  assertWithinResourceLimit,
  getOrCreateSubscription,
  getTenantPlanLimits,
} from './plan-limits';

function buildPrismaMock() {
  return {
    subscription: { findUnique: vi.fn(), create: vi.fn() },
    store: { count: vi.fn() },
    product: { count: vi.fn() },
  };
}

describe('plan-limits', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  describe('getOrCreateSubscription', () => {
    it('retourne un abonnement existant sans en créer un nouveau', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER' });

      const result = await getOrCreateSubscription(prisma as any, 'tenant-1');

      expect(prisma.subscription.create).not.toHaveBeenCalled();
      expect(result.plan).toBe('STARTER');
    });

    it("crée un abonnement Gratuit par défaut si le tenant n'en a pas encore", async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.subscription.create.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE' });

      const result = await getOrCreateSubscription(prisma as any, 'tenant-1');

      expect(prisma.subscription.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1' } });
      expect(result.plan).toBe('FREE');
    });
  });

  describe('getTenantPlanLimits', () => {
    it('retourne les limites correspondant au plan du tenant', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'BUSINESS' });

      const limits = await getTenantPlanLimits(prisma as any, 'tenant-1');

      expect(limits.maxStores).toBeNull();
      expect(limits.accounting).toBe(true);
    });
  });

  describe('assertWithinResourceLimit', () => {
    it('autorise la création sous la limite du plan Gratuit', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.store.count.mockResolvedValue(0);

      await expect(
        assertWithinResourceLimit(prisma as any, 'tenant-1', 'stores'),
      ).resolves.toBeUndefined();
    });

    it('refuse de dépasser la limite de boutiques du plan Gratuit (1)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.store.count.mockResolvedValue(1);

      await expect(assertWithinResourceLimit(prisma as any, 'tenant-1', 'stores')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuse de dépasser la limite de produits du plan Gratuit (50)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.product.count.mockResolvedValue(50);

      await expect(assertWithinResourceLimit(prisma as any, 'tenant-1', 'products')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('un plan Business (illimité) autorise toujours la création', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'BUSINESS' });
      prisma.store.count.mockResolvedValue(50);

      await expect(
        assertWithinResourceLimit(prisma as any, 'tenant-1', 'stores'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertPlanFeature', () => {
    it('refuse la comptabilité sur un plan Gratuit', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });

      await expect(assertPlanFeature(prisma as any, 'tenant-1', 'accounting')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('autorise la comptabilité sur un plan Business', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'BUSINESS' });

      await expect(assertPlanFeature(prisma as any, 'tenant-1', 'accounting')).resolves.toBeUndefined();
    });

    it("refuse les rôles fins (MANAGER/MAGASINIER) sur un plan Gratuit", async () => {
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });

      await expect(assertPlanFeature(prisma as any, 'tenant-1', 'fineRoles')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
