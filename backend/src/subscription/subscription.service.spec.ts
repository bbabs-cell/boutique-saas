import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

function buildPrismaMock() {
  return {
    subscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    invoice: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
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
    it('retourne l’abonnement existant avec les limites du plan et la facture en attente éventuelle', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER' });
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', plan: 'BUSINESS', paidAt: null });

      const result = await service.getSubscription('tenant-1');

      expect(result.plan).toBe('STARTER');
      expect(result.pendingInvoice?.plan).toBe('BUSINESS');
    });
  });

  describe('requestUpgrade', () => {
    it("ne modifie JAMAIS le plan actif directement pour un plan payant — crée seulement une facture en attente", async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE' });
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', plan: 'STARTER', amount: 15000, paidAt: null });

      const result = await service.requestUpgrade('tenant-1', { plan: 'STARTER' } as any);

      // Le point de sécurité central : subscription.update n'est JAMAIS appelé pour un plan payant.
      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plan: 'STARTER', amount: 15000 }) }),
      );
      expect(result.plan).toBe('FREE'); // le plan actif reste inchangé
      expect(result.pendingInvoice?.plan).toBe('STARTER');
    });

    it('applique le passage au plan Gratuit immédiatement (aucun paiement à sécuriser)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'STARTER' });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE', status: 'ACTIVE' });

      const result = await service.requestUpgrade('tenant-1', { plan: 'FREE' } as any);

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { plan: 'FREE', status: 'ACTIVE', expiresAt: null } }),
      );
      expect(prisma.invoice.create).not.toHaveBeenCalled();
      expect(result.plan).toBe('FREE');
    });

    it('ne crée pas de facture en double si une demande identique est déjà en attente', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', plan: 'FREE' });
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-existing', plan: 'STARTER', paidAt: null });

      const result = await service.requestUpgrade('tenant-1', { plan: 'STARTER' } as any);

      expect(prisma.invoice.create).not.toHaveBeenCalled();
      expect(result.pendingInvoice?.id).toBe('inv-existing');
    });
  });

  describe('confirmPayment', () => {
    it("active réellement le plan une fois le paiement confirmé (seul chemin qui modifie subscription.plan pour un plan payant)", async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subscriptionId: 'sub-1',
        plan: 'STARTER',
        paidAt: null,
        periodEnd: new Date('2026-09-01'),
      });
      prisma.subscription.update.mockResolvedValue({ id: 'sub-1', plan: 'STARTER', status: 'ACTIVE' });

      const result = await service.confirmPayment('inv-1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-1' }, data: expect.objectContaining({ paidAt: expect.any(Date) }) }),
      );
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ plan: 'STARTER', status: 'ACTIVE' }),
        }),
      );
      expect(result.plan).toBe('STARTER');
    });

    it('refuse de confirmer deux fois la même facture', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', paidAt: new Date() });

      await expect(service.confirmPayment('inv-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("lève une erreur si la facture n'existe pas", async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.confirmPayment('inconnue')).rejects.toBeInstanceOf(NotFoundException);
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
