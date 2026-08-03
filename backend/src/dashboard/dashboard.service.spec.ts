import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';

function buildPrismaMock() {
  return {
    sale: { findMany: vi.fn() },
    inventory: { findMany: vi.fn() },
    saleItem: { findMany: vi.fn() },
    store: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
  };
}

describe('DashboardService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: DashboardService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new DashboardService(prisma as any);
  });

  describe('getSummary', () => {
    it('agrège le chiffre d’affaires, le nombre de ventes et le bénéfice, et compte les alertes de stock (ADMIN, toutes boutiques)', async () => {
      const now = new Date();
      prisma.sale.findMany.mockResolvedValue([
        {
          createdAt: now,
          subtotal: 10000,
          discount: 1000,
          total: 9000,
          items: [{ quantity: 2, unitCost: 3000 }],
        },
      ]);
      prisma.inventory.findMany.mockResolvedValue([
        { stock: 2, product: { lowStockThreshold: 5 } },
        { stock: 10, product: { lowStockThreshold: 5 } },
      ]);

      const result = await service.getSummary('tenant-1', 'admin-1', 'ADMIN', undefined);

      // bénéfice = (10000 - 1000) - (2 * 3000) = 3000
      expect(result.today.revenue).toBe(9000);
      expect(result.today.salesCount).toBe(1);
      expect(result.today.profit).toBe(3000);
      expect(result.month.revenue).toBe(9000);
      expect(result.lowStockCount).toBe(1);
    });

    it('retourne des métriques à zéro sans ventes', async () => {
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([]);

      const result = await service.getSummary('tenant-1', 'admin-1', 'ADMIN', undefined);

      expect(result.today).toEqual({ revenue: 0, salesCount: 0, profit: 0 });
      expect(result.lowStockCount).toBe(0);
    });

    it('filtre par boutique quand storeId est précisé', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.inventory.findMany.mockResolvedValue([]);

      await service.getSummary('tenant-1', 'admin-1', 'ADMIN', 's1');

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ storeId: 's1' }) }),
      );
    });
  });

  describe('getRevenueChart', () => {
    it('retourne 30 points, un par jour, avec le CA du jour correspondant', async () => {
      const today = new Date();
      prisma.sale.findMany.mockResolvedValue([{ total: 5000, createdAt: today }]);

      const result = await service.getRevenueChart('tenant-1', 'admin-1', 'ADMIN', undefined);

      expect(result).toHaveLength(30);
      const todayKey = today.toISOString().slice(0, 10);
      const todayEntry = result.find((r) => r.date === todayKey);
      expect(todayEntry?.revenue).toBe(5000);
    });
  });

  describe('getTopProducts', () => {
    it('agrège la quantité et le chiffre d’affaires par produit, triés par quantité', async () => {
      prisma.saleItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 2, unitPrice: 1000, product: { id: 'p1', name: 'Riz' } },
        { productId: 'p1', quantity: 1, unitPrice: 1000, product: { id: 'p1', name: 'Riz' } },
        { productId: 'p2', quantity: 5, unitPrice: 500, product: { id: 'p2', name: 'Sucre' } },
      ]);

      const result = await service.getTopProducts('tenant-1', 'admin-1', 'ADMIN', { limit: 10 } as any);

      expect(result[0].name).toBe('Sucre');
      expect(result[0].quantity).toBe(5);
      expect(result[1].name).toBe('Riz');
      expect(result[1].quantity).toBe(3);
      expect(result[1].revenue).toBe(3000);
    });
  });

  describe('getRecentActivity', () => {
    it('retourne les dernières ventes du tenant', async () => {
      prisma.sale.findMany.mockResolvedValue([{ id: 'sale-1' }]);

      const result = await service.getRecentActivity('tenant-1', 'admin-1', 'ADMIN', { limit: 5 } as any);

      expect(result).toHaveLength(1);
      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' }, take: 5 }),
      );
    });
  });
});
