import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

function buildTxMock() {
  return {
    purchaseOrder: { findFirst: vi.fn(), update: vi.fn() },
    purchaseOrderItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    inventory: { upsert: vi.fn() },
    product: { update: vi.fn() },
    stockMovement: { create: vi.fn() },
    supplier: { update: vi.fn() },
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
    supplier: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
    purchaseOrder: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
}

describe('PurchaseOrdersService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: PurchaseOrdersService;

  beforeEach(() => {
    tx = buildTxMock();
    prisma = buildPrismaMock(tx);
    service = new PurchaseOrdersService(prisma as any);
  });

  describe('create', () => {
    it('crée une commande rattachée à la boutique active avec le total calculé', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup1', tenantId: 'tenant-1' });
      prisma.product.findMany.mockResolvedValue([{ id: 'p1', tenantId: 'tenant-1' }]);
      prisma.purchaseOrder.create.mockResolvedValue({ id: 'po1', total: 20000, storeId: 's1' });

      const result = await service.create('tenant-1', 'user-1', 'ADMIN', {
        supplierId: 'sup1',
        items: [{ productId: 'p1', quantity: 10, unitCost: 2000 }],
        status: 'DRAFT',
        storeId: 's1',
      } as any);

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ storeId: 's1', total: 20000, status: 'DRAFT' }),
        }),
      );
      expect(result.id).toBe('po1');
    });

    it("refuse si le fournisseur n'appartient pas au tenant", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', 'ADMIN', {
          supplierId: 'inconnu',
          items: [{ productId: 'p1', quantity: 1, unitCost: 100 }],
          status: 'DRAFT',
          storeId: 's1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('receive', () => {
    it('crédite l’Inventory de la boutique de la commande, met à jour le coût catalogue, journalise un RESTOCK et augmente le solde fournisseur', async () => {
      tx.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po1',
        status: 'ORDERED',
        supplierId: 'sup1',
        storeId: 's1',
        userId: 'user-1',
        total: 20000,
        items: [{ productId: 'p1', quantity: 10, unitCost: 2000 }],
      });
      tx.purchaseOrder.update.mockResolvedValue({ id: 'po1', status: 'RECEIVED' });

      const result = await service.receive('tenant-1', 'po1');

      expect(tx.inventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_storeId: { productId: 'p1', storeId: 's1' } },
          update: { stock: { increment: 10 } },
          create: { productId: 'p1', storeId: 's1', stock: 10 },
        }),
      );
      expect(tx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: { cost: 2000 } }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ storeId: 's1', productId: 'p1', type: 'RESTOCK', quantity: 10 }),
        }),
      );
      expect(tx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sup1' }, data: { balance: { increment: 20000 } } }),
      );
      expect(result.status).toBe('RECEIVED');
    });

    it('refuse de recevoir une commande déjà reçue', async () => {
      tx.purchaseOrder.findFirst.mockResolvedValue({ id: 'po1', status: 'RECEIVED', items: [] });

      await expect(service.receive('tenant-1', 'po1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lève une erreur si la commande n'existe pas dans ce tenant", async () => {
      tx.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(service.receive('tenant-1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
