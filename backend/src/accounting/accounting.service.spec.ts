import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountingService } from './accounting.service';

function buildPrismaMock() {
  return {
    sale: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn() },
    customerPayment: { findMany: vi.fn() },
    supplierPayment: { findMany: vi.fn() },
  };
}

describe('AccountingService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AccountingService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AccountingService(prisma as any);
  });

  describe('resolvePeriod', () => {
    it('utilise les dates personnalisées pour la période "custom"', () => {
      const result = service.resolvePeriod({
        period: 'custom',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.000Z',
      } as any);

      expect(result.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('getSummary', () => {
    it('calcule recettes, dépenses, pertes, bénéfice net et trésorerie', async () => {
      prisma.sale.findMany.mockResolvedValue([
        {
          subtotal: 10000,
          discount: 0,
          total: 10000,
          items: [{ quantity: 2, unitCost: 3000 }],
          payments: [{ method: 'CASH', amount: 10000 }],
        },
        {
          // vente partiellement à crédit : seule la part CASH est un encaissement réel
          subtotal: 5000,
          discount: 0,
          total: 5000,
          items: [{ quantity: 1, unitCost: 2000 }],
          payments: [
            { method: 'CASH', amount: 2000 },
            { method: 'CREDIT', amount: 3000 },
          ],
        },
      ]);
      prisma.expense.findMany.mockResolvedValue([{ amount: 4000 }]);
      prisma.stockMovement.findMany.mockResolvedValue([
        { quantity: -2, product: { cost: 3000 } }, // perte valorisée : 6000
      ]);
      prisma.customerPayment.findMany.mockResolvedValue([{ amount: 1000 }]);
      prisma.supplierPayment.findMany.mockResolvedValue([{ amount: 2500 }]);

      const result = await service.getSummary('tenant-1', { period: 'month' } as any);

      // recettes = 10000 + 5000
      expect(result.revenue).toBe(15000);
      // bénéfice brut = (10000-0-6000) + (5000-0-2000) = 4000 + 3000 = 7000
      // bénéfice net = 7000 - dépenses(4000) - pertes(6000) = -3000
      expect(result.expenses).toBe(4000);
      expect(result.losses).toBe(6000);
      expect(result.netProfit).toBe(-3000);
      // trésorerie = encaissements ventes hors crédit (10000+2000) + règlements clients (1000)
      //              - dépenses (4000) - règlements fournisseurs (2500) = 6500
      expect(result.cashFlow).toBe(6500);
      expect(result.salesCount).toBe(2);
    });

    it('retourne des valeurs à zéro sans aucune activité', async () => {
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.expense.findMany.mockResolvedValue([]);
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.customerPayment.findMany.mockResolvedValue([]);
      prisma.supplierPayment.findMany.mockResolvedValue([]);

      const result = await service.getSummary('tenant-1', { period: 'month' } as any);

      expect(result.revenue).toBe(0);
      expect(result.netProfit).toBe(0);
      expect(result.cashFlow).toBe(0);
    });
  });
});
