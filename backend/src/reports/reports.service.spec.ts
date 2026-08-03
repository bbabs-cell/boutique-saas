import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsService } from './reports.service';

function buildPrismaMock() {
  return {
    tenant: { findUniqueOrThrow: vi.fn() },
    sale: { findMany: vi.fn() },
    store: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
  };
}

describe('ReportsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ReportsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ReportsService(prisma as any);
  });

  describe('resolvePeriod', () => {
    it('utilise les dates personnalisées pour la période "custom"', () => {
      const result = service.resolvePeriod({
        period: 'custom',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.000Z',
      } as any);

      expect(result.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(result.to.toISOString()).toBe('2026-01-31T23:59:59.000Z');
    });

    it('calcule le début du mois pour la période "month"', () => {
      const result = service.resolvePeriod({ period: 'month' } as any);
      expect(result.from.getUTCDate()).toBe(1);
    });
  });

  describe('getSalesReport', () => {
    it('agrège CA, nombre de ventes et bénéfice sur la période', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({ name: 'Boutique Demo' });
      prisma.sale.findMany.mockResolvedValue([
        {
          subtotal: 10000,
          discount: 0,
          total: 10000,
          items: [{ quantity: 2, unitCost: 3000 }],
        },
        {
          subtotal: 5000,
          discount: 500,
          total: 4500,
          items: [{ quantity: 1, unitCost: 2000 }],
        },
      ]);

      const result = await service.getSalesReport('tenant-1', 'admin-1', 'ADMIN', { period: 'month' } as any);

      expect(result.tenantName).toBe('Boutique Demo');
      expect(result.summary.revenue).toBe(14500);
      expect(result.summary.salesCount).toBe(2);
      // bénéfice = (10000-0-6000) + (5000-500-2000) = 4000 + 2500 = 6500
      expect(result.summary.profit).toBe(6500);
    });

    it('applique le filtre vendeur (userId) dans la requête', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({ name: 'Boutique Demo' });
      prisma.sale.findMany.mockResolvedValue([]);

      await service.getSalesReport('tenant-1', 'admin-1', 'ADMIN', { period: 'month', userId: 'user-1' } as any);

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
        }),
      );
    });

    it('applique le filtre produit via la relation items', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({ name: 'Boutique Demo' });
      prisma.sale.findMany.mockResolvedValue([]);

      await service.getSalesReport('tenant-1', 'admin-1', 'ADMIN', { period: 'month', productId: 'p1' } as any);

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ items: { some: { productId: 'p1' } } }),
        }),
      );
    });
  });
});
