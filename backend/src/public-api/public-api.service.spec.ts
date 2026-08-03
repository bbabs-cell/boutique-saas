import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicApiService } from './public-api.service';

function buildPrismaMock() {
  return {
    $transaction: vi.fn((arr: any[]) => Promise.all(arr)),
    product: { findMany: vi.fn(), count: vi.fn() },
    sale: { findMany: vi.fn(), count: vi.fn() },
    inventory: { findMany: vi.fn(), count: vi.fn() },
  };
}

describe('PublicApiService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: PublicApiService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new PublicApiService(prisma as any);
  });

  describe('getProducts', () => {
    it('retourne les produits actifs du tenant, paginés', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Riz 5kg' }]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.getProducts('tenant-1', { page: 1, pageSize: 20 } as any);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1', active: true } }),
      );
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getSales', () => {
    it('ne retourne que les ventes validées (COMPLETED)', async () => {
      prisma.sale.findMany.mockResolvedValue([{ id: 'sale-1' }]);
      prisma.sale.count.mockResolvedValue(1);

      await service.getSales('tenant-1', { page: 1, pageSize: 20 } as any);

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1', status: 'COMPLETED' } }),
      );
    });
  });

  describe('getStock', () => {
    it('retourne le niveau de stock par produit et boutique', async () => {
      prisma.inventory.findMany.mockResolvedValue([{ productId: 'p1', storeId: 's1', stock: 10 }]);
      prisma.inventory.count.mockResolvedValue(1);

      const result = await service.getStock('tenant-1', { page: 1, pageSize: 20 } as any);

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { product: { tenantId: 'tenant-1', active: true } } }),
      );
      expect(result.items).toHaveLength(1);
    });
  });
});
