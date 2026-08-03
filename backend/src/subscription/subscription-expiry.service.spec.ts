import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionExpiryService } from './subscription-expiry.service';

function buildPrismaMock() {
  return {
    subscription: { findMany: vi.fn(), updateMany: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
  };
}

describe('SubscriptionExpiryService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: SubscriptionExpiryService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new SubscriptionExpiryService(prisma as any);
  });

  describe('notifyExpiringSoon', () => {
    it('crée une notification SUBSCRIPTION_EXPIRING pour un abonnement qui expire bientôt', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 3);
      prisma.subscription.findMany.mockResolvedValue([
        { tenantId: 'tenant-1', plan: 'STARTER', expiresAt: soon, tenant: { name: 'Boutique X' } },
      ]);
      prisma.notification.findFirst.mockResolvedValue(null);

      const count = await service.notifyExpiringSoon();

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1', type: 'SUBSCRIPTION_EXPIRING', userId: null }),
        }),
      );
      expect(count).toBe(1);
    });

    it('ne crée pas de doublon si une notification a déjà été envoyée dans les dernières 24h', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 3);
      prisma.subscription.findMany.mockResolvedValue([
        { tenantId: 'tenant-1', plan: 'STARTER', expiresAt: soon, tenant: { name: 'Boutique X' } },
      ]);
      prisma.notification.findFirst.mockResolvedValue({ id: 'existing-notif' });

      await service.notifyExpiringSoon();

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("ne crée aucune notification s'il n'y a aucun abonnement proche de l'expiration", async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const count = await service.notifyExpiringSoon();

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });

  describe('markExpired', () => {
    it('passe au statut EXPIRED les abonnements dont la date est dépassée', async () => {
      prisma.subscription.updateMany.mockResolvedValue({ count: 2 });

      const count = await service.markExpired();

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
          data: { status: 'EXPIRED' },
        }),
      );
      expect(count).toBe(2);
    });
  });
});
