import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SyncService } from './sync.service';

function buildPrismaMock() {
  return {
    tenant: { findUniqueOrThrow: vi.fn() },
    store: { findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    sale: { findUnique: vi.fn() },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
  };
}

function buildSalesServiceMock() {
  return { create: vi.fn() };
}

describe('SyncService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let salesService: ReturnType<typeof buildSalesServiceMock>;
  let service: SyncService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    salesService = buildSalesServiceMock();
    service = new SyncService(prisma as any, salesService as any);
  });

  describe('bootstrap', () => {
    it('retourne le catalogue avec le stock de la boutique demandée, les clients et les paramètres du tenant', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.userStore.findUnique.mockResolvedValue({ userId: 'user-1', storeId: 's1' });
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        name: 'Boutique Demo',
        currency: 'XOF',
        tvaEnabled: true,
        tvaRate: 18,
      });
      prisma.store.findUniqueOrThrow.mockResolvedValue({ id: 's1', name: 'Bamako' });
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Riz 5kg', barcode: '123', price: 5000, cost: 4000, lowStockThreshold: 5, categoryId: null, inventory: [{ stock: 12 }] },
      ]);
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'Fatou', phone: null, creditLimit: 20000, creditBalance: 0 }]);

      const result = await service.bootstrap('tenant-1', 'user-1', 'CAISSIER', { storeId: 's1' } as any);

      expect(result.store.name).toBe('Bamako');
      expect(result.products[0].stock).toBe(12);
      expect(result.products[0]).not.toHaveProperty('inventory');
      expect(result.customers).toHaveLength(1);
      expect(result.syncedAt).toBeTruthy();
    });
  });

  describe('processSalesBatch', () => {
    const baseOfflineSale = {
      clientSaleId: 'offline-sale-1',
      items: [{ productId: 'p1', quantity: 2 }],
      discount: 0,
      payments: [{ method: 'CASH', amount: 10000 }],
      customerId: null,
      storeId: 's1',
    };

    it('accepte une vente hors-ligne valide et la crée via SalesService (revalidation complète)', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);
      salesService.create.mockResolvedValue({ id: 'sale-server-1' });

      const result = await service.processSalesBatch('tenant-1', 'user-1', 'CAISSIER', [baseOfflineSale as any]);

      expect(salesService.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'CAISSIER',
        expect.objectContaining({ clientId: 'offline-sale-1', storeId: 's1' }),
      );
      expect(result.results).toEqual([
        { clientSaleId: 'offline-sale-1', status: 'accepted', saleId: 'sale-server-1' },
      ]);
    });

    it('signale un conflit (et ne l’ignore pas silencieusement) quand le stock est insuffisant à la synchro', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);
      salesService.create.mockRejectedValue(
        new BadRequestException('Stock insuffisant pour « Riz 5kg » (disponible : 1, demandé : 2).'),
      );

      const result = await service.processSalesBatch('tenant-1', 'user-1', 'CAISSIER', [baseOfflineSale as any]);

      expect(result.results).toEqual([
        {
          clientSaleId: 'offline-sale-1',
          status: 'conflict',
          reason: 'Stock insuffisant pour « Riz 5kg » (disponible : 1, demandé : 2).',
        },
      ]);
    });

    it('marque une vente déjà connue (même clientSaleId) comme already_synced sans la recréer', async () => {
      prisma.sale.findUnique.mockResolvedValue({ id: 'sale-existing-1' });

      const result = await service.processSalesBatch('tenant-1', 'user-1', 'CAISSIER', [baseOfflineSale as any]);

      expect(salesService.create).not.toHaveBeenCalled();
      expect(result.results).toEqual([
        { clientSaleId: 'offline-sale-1', status: 'already_synced', saleId: 'sale-existing-1' },
      ]);
    });

    it('traite chaque vente du lot indépendamment : un conflit sur une vente ne bloque pas les suivantes', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);
      salesService.create
        .mockRejectedValueOnce(new BadRequestException('Stock insuffisant.'))
        .mockResolvedValueOnce({ id: 'sale-server-2' });

      const secondSale = { ...baseOfflineSale, clientSaleId: 'offline-sale-2' };
      const result = await service.processSalesBatch('tenant-1', 'user-1', 'CAISSIER', [
        baseOfflineSale as any,
        secondSale as any,
      ]);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('conflict');
      expect(result.results[1].status).toBe('accepted');
    });

    it('rejoue les ventes du lot dans l’ordre reçu (séquentiel, pas en parallèle)', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);
      const callOrder: string[] = [];
      salesService.create.mockImplementation(async (_t: string, _u: string, _r: string, dto: any) => {
        callOrder.push(dto.clientId);
        return { id: `sale-${dto.clientId}` };
      });

      const sales = [
        { ...baseOfflineSale, clientSaleId: 'a' },
        { ...baseOfflineSale, clientSaleId: 'b' },
        { ...baseOfflineSale, clientSaleId: 'c' },
      ];
      await service.processSalesBatch('tenant-1', 'user-1', 'CAISSIER', sales as any);

      expect(callOrder).toEqual(['a', 'b', 'c']);
    });
  });
});
