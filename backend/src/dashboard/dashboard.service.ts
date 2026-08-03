import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeSaleProfit, startOfUTCDay, startOfUTCMonth, startOfUTCWeek, toDateKey } from '../common/sales-metrics';
import { resolveActiveStoreId } from '../common/stores-helper';
import { RecentActivityQueryDto, TopProductsQueryDto } from './dto/dashboard.dto';

interface PeriodMetrics {
  revenue: number;
  salesCount: number;
  profit: number;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(tenantId: string, userId: string, role: string, requestedStoreId?: string) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, true);

    const now = new Date();
    const dayStart = startOfUTCDay(now);
    const weekStart = startOfUTCWeek(now);
    const monthStart = startOfUTCMonth(now);

    // On récupère une seule fois toutes les ventes depuis le début du mois (qui couvre
    // aussi la semaine et le jour) puis on découpe les métriques en mémoire.
    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: { gte: monthStart },
        ...(storeId ? { storeId } : {}),
      },
      include: { items: true },
    });

    const day = this.aggregate(sales.filter((s) => s.createdAt >= dayStart));
    const week = this.aggregate(sales.filter((s) => s.createdAt >= weekStart));
    const month = this.aggregate(sales);

    const inventory = await this.prisma.inventory.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        product: { tenantId, active: true, lowStockThreshold: { not: null } },
      },
      select: { stock: true, product: { select: { lowStockThreshold: true } } },
    });
    const lowStockCount = inventory.filter(
      (i) => i.product.lowStockThreshold !== null && i.stock <= i.product.lowStockThreshold,
    ).length;

    return { today: day, week, month, lowStockCount, storeId };
  }

  async getRevenueChart(tenantId: string, userId: string, role: string, requestedStoreId?: string) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, true);

    const now = new Date();
    const start = startOfUTCDay(now);
    start.setUTCDate(start.getUTCDate() - 29); // 30 jours glissants, aujourd'hui inclus

    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: { gte: start },
        ...(storeId ? { storeId } : {}),
      },
      select: { total: true, createdAt: true },
    });

    const revenueByDay = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      revenueByDay.set(toDateKey(d), 0);
    }
    for (const sale of sales) {
      const key = toDateKey(sale.createdAt);
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + sale.total);
    }

    return [...revenueByDay.entries()].map(([date, revenue]) => ({ date, revenue }));
  }

  async getTopProducts(tenantId: string, userId: string, role: string, query: TopProductsQueryDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    const items = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: 'COMPLETED',
          ...(storeId ? { storeId } : {}),
          ...(query.from || query.to
            ? {
                createdAt: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              }
            : {}),
        },
      },
      include: { product: { select: { id: true, name: true } } },
    });

    const byProduct = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const existing = byProduct.get(item.productId);
      const revenue = item.unitPrice * item.quantity;
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += revenue;
      } else {
        byProduct.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          quantity: item.quantity,
          revenue,
        });
      }
    }

    return [...byProduct.values()].sort((a, b) => b.quantity - a.quantity).slice(0, query.limit);
  }

  async getRecentActivity(tenantId: string, userId: string, role: string, query: RecentActivityQueryDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    return this.prisma.sale.findMany({
      where: { tenantId, ...(storeId ? { storeId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
  }

  private aggregate(sales: { subtotal: number; discount: number; total: number; items: { quantity: number; unitCost: number }[] }[]): PeriodMetrics {
    return {
      revenue: sales.reduce((sum, s) => sum + s.total, 0),
      salesCount: sales.length,
      profit: sales.reduce((sum, s) => sum + computeSaleProfit(s), 0),
    };
  }
}
