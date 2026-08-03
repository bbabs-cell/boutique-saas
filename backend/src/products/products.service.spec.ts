import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function buildPrismaMock() {
  return {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    store: { findFirst: vi.fn(), findMany: vi.fn() },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe('ProductsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ProductsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ProductsService(prisma as any);
  });

  it('liste les produits avec pagination et le stock de la boutique active', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
    prisma.$transaction.mockResolvedValue([
      [{ id: 'p1', name: 'Riz 5kg', inventory: [{ storeId: 's1', stock: 12 }] }],
      1,
    ]);

    const result = await service.findAll('tenant-1', 'admin-1', 'ADMIN', {
      page: 1,
      pageSize: 20,
      storeId: 's1',
    } as any);

    expect(result.total).toBe(1);
    expect(result.items[0].stock).toBe(12);
    expect(result.storeId).toBe('s1');
  });

  it('agrège le stock sur toutes les boutiques quand aucune boutique n’est active (vue ADMIN)', async () => {
    prisma.store.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'p1',
          name: 'Riz 5kg',
          inventory: [
            { storeId: 's1', stock: 12 },
            { storeId: 's2', stock: 5 },
          ],
        },
      ],
      1,
    ]);

    const result = await service.findAll('tenant-1', 'admin-1', 'ADMIN', {
      page: 1,
      pageSize: 20,
    } as any);

    expect(result.items[0].stock).toBe(17);
    expect(result.storeId).toBeNull();
  });

  it('crée un produit avec un stock initial pour la boutique active', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: 'p1',
      name: 'Riz 5kg',
      inventory: [{ storeId: 's1', stock: 10 }],
    });

    const result = await service.create(
      'tenant-1',
      'admin-1',
      'ADMIN',
      { name: 'Riz 5kg', price: 5000, cost: 4000, stock: 10 } as any,
      's1',
    );

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inventory: { create: { storeId: 's1', stock: 10 } } }),
      }),
    );
    expect(result.stock).toBe(10);
  });

  it('rejette un code-barres déjà utilisé dans le même tenant', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create(
        'tenant-1',
        'admin-1',
        'ADMIN',
        { name: 'Riz 5kg', barcode: '123456', price: 5000, cost: 4000, stock: 10 } as any,
        's1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lève une erreur si le produit à modifier est introuvable', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.update('tenant-1', 'unknown', { name: 'X' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("ignore un champ stock envoyé à la modification (non applicable, géré par le module Stock)", async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'p1', tenantId: 'tenant-1' });
    prisma.product.update.mockResolvedValue({ id: 'p1', name: 'Riz 5kg' });

    await service.update('tenant-1', 'p1', { name: 'Riz 5kg', stock: 999 } as any);

    const callArgs = prisma.product.update.mock.calls[0][0];
    expect(callArgs.data.stock).toBeUndefined();
  });

  it('fait un soft delete (active = false)', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'p1', tenantId: 'tenant-1' });
    prisma.product.update.mockResolvedValue({ id: 'p1', active: false });

    const result = await service.softDelete('tenant-1', 'p1');

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
    expect(result.active).toBe(false);
  });

  it('recherche par code-barres avec le stock de la boutique active', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
    prisma.product.findFirst.mockResolvedValue({
      id: 'p1',
      barcode: '123456',
      inventory: [{ storeId: 's1', stock: 7 }],
    });

    const result = await service.findByBarcode('tenant-1', 'admin-1', 'ADMIN', '123456', 's1');

    expect(result.barcode).toBe('123456');
    expect(result.stock).toBe(7);
  });

  it("lève une erreur si le code-barres n'existe pas", async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.findByBarcode('tenant-1', 'admin-1', 'ADMIN', 'inconnu', 's1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
