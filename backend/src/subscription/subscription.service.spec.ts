import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from './subscription.service';

function buildPrismaMock() {
  return {
    subscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    invoice: { create: vi.fn(), findMany: vi.fn() },
  };
}

describe('SubscriptionService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: SubscriptionService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new SubscriptionService(prisma as any);
  });

  describe('getSubscription', () => {
    it('retourne l’abonnement existant avec les limites du plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER' });

      const result = await service.getSubscription('tenant-1');

      expect(result.plan).toBe('STARTER');
      expect(result.limits.maxStores).toBe(3);
    });

    it('crée un abonnement Gratuit par défaut si aucun n’existe', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.subscription.create.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE' });

      const result = await service.getSubscription('tenant-1');

      expect(prisma.subscription.create).toHaveBeenCalled();
      expect(result.plan).toBe('FREE');
    });
  });

  describe('upgrade', () => {
    it('change de plan, fixe une date d’expiration et crée une facture non payée pour un plan payant', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER', status: 'ACTIVE' });
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1' });

      const result = await service.upgrade('tenant-1', { plan: 'STARTER' } as any);

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ plan: 'STARTER', status: 'ACTIVE' }),
        }),
      );
      const updateCall = prisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.expiresAt).toBeInstanceOf(Date);

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionId: 'sub-1', plan: 'STARTER', amount: 15000 }),
        }),
      );
      expect(result.plan).toBe('STARTER');
      expect(result.limits.fineRoles).toBe(true);
    });

    it('ne crée pas de facture pour un retour au plan Gratuit et fixe expiresAt à null', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE', status: 'ACTIVE' });

      await service.upgrade('tenant-1', { plan: 'FREE' } as any);

      expect(prisma.invoice.create).not.toHaveBeenCalled();
      const updateCall = prisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.expiresAt).toBeNull();
    });
  });

  describe('listInvoices', () => {
    it('liste les factures de l’abonnement du tenant, triées par date décroissante', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER' });
      prisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);

      const result = await service.listInvoices('tenant-1');

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { subscriptionId: 'sub-1' }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
