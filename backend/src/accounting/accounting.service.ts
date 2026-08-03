import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeSaleProfit,
  startOfUTCDay,
  startOfUTCMonth,
  startOfUTCWeek,
  startOfUTCYear,
} from '../common/sales-metrics';
import { AccountingSummaryQueryDto } from './dto/accounting.dto';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  resolvePeriod(query: AccountingSummaryQueryDto): { from: Date; to: Date } {
    const now = new Date();
    if (query.period === 'custom') {
      return { from: new Date(query.from!), to: new Date(query.to!) };
    }
    const startByPeriod: Record<string, Date> = {
      day: startOfUTCDay(now),
      week: startOfUTCWeek(now),
      month: startOfUTCMonth(now),
      year: startOfUTCYear(now),
    };
    return { from: startByPeriod[query.period], to: now };
  }

  async getSummary(tenantId: string, query: AccountingSummaryQueryDto) {
    const { from, to } = this.resolvePeriod(query);
    const dateFilter = { gte: from, lte: to };

    const [sales, expenses, negativeAdjustments, customerPayments, supplierPayments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { tenantId, status: 'COMPLETED', createdAt: dateFilter },
        include: { items: true, payments: true },
      }),
      this.prisma.expense.findMany({ where: { tenantId, createdAt: dateFilter } }),
      this.prisma.stockMovement.findMany({
        where: { tenantId, type: 'ADJUSTMENT', quantity: { lt: 0 }, createdAt: dateFilter },
        include: { product: { select: { cost: true } } },
      }),
      this.prisma.customerPayment.findMany({ where: { tenantId, createdAt: dateFilter } }),
      this.prisma.supplierPayment.findMany({ where: { tenantId, createdAt: dateFilter } }),
    ]);

    const revenue = sales.reduce((sum, s) => sum + s.total, 0);
    const grossProfit = sales.reduce((sum, s) => sum + computeSaleProfit(s), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    // Pertes : ajustements de stock négatifs (casse, péremption, écart de comptage), valorisés au coût actuel du produit.
    const losses = negativeAdjustments.reduce((sum, m) => sum + Math.abs(m.quantity) * m.product.cost, 0);
    const netProfit = grossProfit - totalExpenses - losses;

    // Trésorerie : encaissements réels (hors ventes à crédit) moins décaissements réels.
    const cashInFromSales = sales.reduce(
      (sum, s) => sum + s.payments.filter((p) => p.method !== 'CREDIT').reduce((s2, p) => s2 + p.amount, 0),
      0,
    );
    const cashInFromCustomerPayments = customerPayments.reduce((sum, p) => sum + p.amount, 0);
    const cashOutExpenses = totalExpenses;
    const cashOutSupplierPayments = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const cashFlow = cashInFromSales + cashInFromCustomerPayments - cashOutExpenses - cashOutSupplierPayments;

    return {
      period: { from, to },
      revenue,
      expenses: totalExpenses,
      losses,
      netProfit,
      cashFlow,
      salesCount: sales.length,
    };
  }
}
