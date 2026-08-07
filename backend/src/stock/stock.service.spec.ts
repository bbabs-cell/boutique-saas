import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';

function buildTxMock() {
  return {
    product: { findFirst: vi.fn() },
    inventory: { findUnique: vi.fn(), upsert: vi.fn() },
    stockMovement: { create: vi.fn() },
    notification: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
  };
}

function buildPrismaMock(tx: ReturnType<typeof buildTxMock>) {
  return {
    $transaction: vi.fn((cbOrArray: any) => {
      if (typeof cbOrArray === 'function') return cbOrArray(tx);
      return Promise.all(cbOrArray);
    }),
    store: { findFirst: vi.fn(), findMany: vi.fn() },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
    inventory: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), count: vi.fn() },
    webhook: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe('StockService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: StockService;

  beforeEach(() => {
    tx = buildTxMock();
    prisma = buildPrismaMock(tx);
    service = new StockService(prisma as any);
  });

  describe('createAdjustment', () => {
    it('ajuste le stock de la boutique demandée (deux boutiques, stocks indépendants)', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.product.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Riz 5kg',
        lowStockThreshold: 5,
        tenantId: 'tenant-1',
      });
      tx.inventory.findUnique.mockResolvedValue({ productId: 'p1', storeId: 's1', stock: 10 });
      tx.stockMovement.create.mockResolvedValue({ id: 'm1', quantity: 5, storeId: 's1' });

      const result = await service.createAdjustment('tenant-1', 'admin-1', 'ADMIN', {
        productId: 'p1',
        quantity: 5,
        reason: 'réception',
        storeId: 's1',
      } as any);

      expect(tx.inventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_storeId: { productId: 'p1', storeId: 's1' } },
          update: { stock: 15 },
        }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ storeId: 's1', quantity: 5 }) }),
      );
      expect(result.storeId).toBe('s1');
    });

    it("n'affecte pas le stock d'une autre boutique (isolation)", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's2', tenantId: 'tenant-1' });
      tx.product.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Riz 5kg',
        lowStockThreshold: null,
        tenantId: 'tenant-1',
      });
      // Boutique s2 n'a pas encore de ligne Inventory pour ce produit → stock actuel 0
      tx.inventory.findUnique.mockResolvedValue(null);
      tx.stockMovement.create.mockResolvedValue({ id: 'm2', quantity: 8, storeId: 's2' });

      await service.createAdjustment('tenant-1', 'admin-1', 'ADMIN', {
        productId: 'p1',
        quantity: 8,
        storeId: 's2',
      } as any);

      expect(tx.inventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_storeId: { productId: 'p1', storeId: 's2' } },
          update: { stock: 8 },
          create: { productId: 'p1', storeId: 's2', stock: 8 },
        }),
      );
    });

    it('refuse un ajustement qui ferait passer le stock en négatif', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.product.findFirst.mockResolvedValue({ id: 'p1', name: 'Riz 5kg', lowStockThreshold: null });
      tx.inventory.findUnique.mockResolvedValue({ productId: 'p1', storeId: 's1', stock: 2 });

      await expect(
        service.createAdjustment('tenant-1', 'admin-1', 'ADMIN', {
          productId: 'p1',
          quantity: -5,
          storeId: 's1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it("lève une erreur si le produit n'appartient pas au tenant", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.product.findFirst.mockResolvedValue(null);

      await expect(
        service.createAdjustment('tenant-1', 'admin-1', 'ADMIN', {
          productId: 'inconnu',
          quantity: 1,
          storeId: 's1',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('appelle le webhook abonné à stock.low quand un ajustement fait passer le stock sous le seuil', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      tx.product.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Riz 5kg',
        lowStockThreshold: 5,
        tenantId: 'tenant-1',
      });
      tx.inventory.findUnique.mockResolvedValue({ productId: 'p1', storeId: 's1', stock: 8 });
      tx.stockMovement.create.mockResolvedValue({
        id: 'm1',
        productId: 'p1',
        storeId: 's1',
        product: { name: 'Riz 5kg', lowStockThreshold: 5 },
      });
      prisma.webhook.findMany.mockResolvedValue([
        { id: 'wh-1', url: 'https://example.com/hook', secret: 's', events: ['stock.low'] },
      ]);
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);

      // 8 - 4 = 4, sous le seuil de 5
      await service.createAdjustment('tenant-1', 'admin-1', 'ADMIN', {
        productId: 'p1',
        quantity: -4,
        storeId: 's1',
      } as any);

      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/hook', expect.objectContaining({ method: 'POST' }));
      vi.unstubAllGlobals();
    });
  });

  describe('findAlerts', () => {
    it('retourne uniquement les lignes Inventory sous leur seuil, pour la boutique active', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.inventory.findMany.mockResolvedValue([
        { stock: 2, product: { id: 'p1', lowStockThreshold: 5 }, store: { id: 's1', name: 'Bamako' } },
        { stock: 10, product: { id: 'p2', lowStockThreshold: 5 }, store: { id: 's1', name: 'Bamako' } },
      ]);

      const result = await service.findAlerts('tenant-1', 'admin-1', 'ADMIN', 's1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });
  });
});
