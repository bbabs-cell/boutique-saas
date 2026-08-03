import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';

function buildTxMock() {
  return {
    tenant: { findUniqueOrThrow: vi.fn() },
    product: { findMany: vi.fn() },
    inventory: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({ productId: 'p1', storeId: 's1', stock: 100 }),
      upsert: vi.fn(),
    },
    customer: { findFirst: vi.fn(), update: vi.fn() },
    stockMovement: { create: vi.fn() },
    notification: { create: vi.fn() },
    sale: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
}

function buildPrismaMock(tx: ReturnType<typeof buildTxMock>) {
  return {
    $transaction: vi.fn((cbOrArray: any) => {
      if (typeof cbOrArray === 'function') {
        return cbOrArray(tx);
      }
      return Promise.all(cbOrArray);
    }),
    store: { findFirst: vi.fn(), findMany: vi.fn() },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
    sale: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    webhook: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe('SalesService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: SalesService;

  beforeEach(() => {
    tx = buildTxMock();
    prisma = buildPrismaMock(tx);
    service = new SalesService(prisma as any);
  });

  describe('create', () => {
    const baseProduct = { id: 'p1', name: 'Riz 5kg', price: 5000, cost: 3000, tenantId: 'tenant-1' };

    it('crée une vente, décrémente le stock de la boutique active, journalise un mouvement SALE', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', tvaEnabled: false, tvaRate: 0 });
      tx.product.findMany.mockResolvedValue([baseProduct]);
      tx.inventory.findMany.mockResolvedValue([{ productId: 'p1', storeId: 's1', stock: 10 }]);
      tx.sale.create.mockResolvedValue({ id: 'sale-1', total: 9000, storeId: 's1', items: [{}], createdAt: new Date() });

      const result = await service.create('tenant-1', 'user-1', 'ADMIN', {
        items: [{ productId: 'p1', quantity: 2 }],
        discount: 1000,
        payments: [
          { method: 'CASH', amount: 5000 },
          { method: 'ORANGE_MONEY', amount: 4000 },
        ],
        storeId: 's1',
      } as any);

      expect(tx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_storeId: { productId: 'p1', storeId: 's1' } },
          data: { stock: { decrement: 2 } },
        }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ storeId: 's1', productId: 'p1', type: 'SALE', quantity: -2 }),
        }),
      );
      expect(tx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ storeId: 's1', total: 9000 }) }),
      );
      expect(result.id).toBe('sale-1');
    });

    it("une vente dans la boutique B ne consomme pas le stock de la boutique A (isolation)", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 'store-B', tenantId: 'tenant-1' });
      tx.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', tvaEnabled: false, tvaRate: 0 });
      tx.product.findMany.mockResolvedValue([baseProduct]);
      // Le même produit a un stock différent dans chaque boutique.
      tx.inventory.findMany.mockResolvedValue([{ productId: 'p1', storeId: 'store-B', stock: 3 }]);
      tx.sale.create.mockResolvedValue({ id: 'sale-2', storeId: 'store-B', items: [{}], createdAt: new Date() });

      await service.create('tenant-1', 'user-1', 'ADMIN', {
        items: [{ productId: 'p1', quantity: 2 }],
        discount: 0,
        payments: [{ method: 'CASH', amount: 10000 }],
        storeId: 'store-B',
      } as any);

      // La requête d'inventaire ne porte que sur store-B.
      expect(tx.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-B' }) }),
      );
      expect(tx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId_storeId: { productId: 'p1', storeId: 'store-B' } } }),
      );
    });

    it('refuse si le stock de la boutique active est insuffisant, même si une autre boutique en a assez', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', tvaEnabled: false, tvaRate: 0 });
      tx.product.findMany.mockResolvedValue([baseProduct]);
      // Stock insuffisant dans la boutique demandée (s1), peu importe le stock ailleurs.
      tx.inventory.findMany.mockResolvedValue([{ productId: 'p1', storeId: 's1', stock: 1 }]);

      await expect(
        service.create('tenant-1', 'user-1', 'ADMIN', {
          items: [{ productId: 'p1', quantity: 2 }],
          discount: 0,
          payments: [{ method: 'CASH', amount: 10000 }],
          storeId: 's1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.sale.create).not.toHaveBeenCalled();
    });

    it("refuse si le total des paiements ne couvre pas le total de la vente", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', tvaEnabled: false, tvaRate: 0 });
      tx.product.findMany.mockResolvedValue([baseProduct]);
      tx.inventory.findMany.mockResolvedValue([{ productId: 'p1', storeId: 's1', stock: 10 }]);

      await expect(
        service.create('tenant-1', 'user-1', 'ADMIN', {
          items: [{ productId: 'p1', quantity: 1 }],
          discount: 0,
          payments: [{ method: 'CASH', amount: 1000 }],
          storeId: 's1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
    it('appelle le webhook abonné à sale.created une fois la vente validée', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', tvaEnabled: false, tvaRate: 0 });
      tx.product.findMany.mockResolvedValue([baseProduct]);
      tx.inventory.findMany.mockResolvedValue([{ productId: 'p1', storeId: 's1', stock: 10 }]);
      tx.sale.create.mockResolvedValue({
        id: 'sale-1',
        storeId: 's1',
        total: 5000,
        items: [{}],
        createdAt: new Date(),
      });
      prisma.webhook.findMany.mockResolvedValue([
        { id: 'wh-1', url: 'https://example.com/hook', secret: 's', events: ['sale.created'] },
      ]);
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);

      await service.create('tenant-1', 'user-1', 'ADMIN', {
        items: [{ productId: 'p1', quantity: 1 }],
        discount: 0,
        payments: [{ method: 'CASH', amount: 5000 }],
        storeId: 's1',
      } as any);

      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/hook', expect.objectContaining({ method: 'POST' }));
      vi.unstubAllGlobals();
    });
  });

  describe('cancel', () => {
    it('remet le stock dans la boutique où la vente a eu lieu', async () => {
      tx.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        userId: 'user-1',
        storeId: 's1',
        status: 'COMPLETED',
        customerId: null,
        items: [{ productId: 'p1', quantity: 2 }],
        payments: [{ method: 'CASH', amount: 10000 }],
      });
      tx.sale.update.mockResolvedValue({ id: 'sale-1', status: 'CANCELLED' });

      await service.cancel('tenant-1', 'sale-1');

      expect(tx.inventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_storeId: { productId: 'p1', storeId: 's1' } },
          update: { stock: { increment: 2 } },
        }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ storeId: 's1', type: 'RESTOCK' }) }),
      );
    });

    it('refuse d’annuler une vente déjà annulée', async () => {
      tx.sale.findFirst.mockResolvedValue({ id: 'sale-1', status: 'CANCELLED', items: [], payments: [] });

      await expect(service.cancel('tenant-1', 'sale-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("lève une erreur si la vente n'existe pas dans ce tenant", async () => {
      tx.sale.findFirst.mockResolvedValue(null);

      await expect(service.cancel('tenant-1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
