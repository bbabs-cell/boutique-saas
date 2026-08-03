import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeSaleProfit,
  startOfUTCDay,
  startOfUTCMonth,
  startOfUTCWeek,
  startOfUTCYear,
} from '../common/sales-metrics';
import { resolveActiveStoreId } from '../common/stores-helper';
import { SalesReportQueryDto } from './dto/reports.dto';

const REPORT_SALE_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, categoryId: true } } } },
  payments: true,
  user: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  resolvePeriod(query: SalesReportQueryDto): { from: Date; to: Date } {
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

  async getSalesReport(tenantId: string, userId: string, role: string, query: SalesReportQueryDto) {
    const { from, to } = this.resolvePeriod(query);
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true },
    });

    const where: Prisma.SaleWhereInput = {
      tenantId,
      status: 'COMPLETED',
      createdAt: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.productId
        ? { items: { some: { productId: query.productId } } }
        : {}),
      ...(query.categoryId
        ? { items: { some: { product: { categoryId: query.categoryId } } } }
        : {}),
    };

    const sales = await this.prisma.sale.findMany({
      where,
      include: REPORT_SALE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      revenue: sales.reduce((sum, s) => sum + s.total, 0),
      salesCount: sales.length,
      profit: sales.reduce((sum, s) => sum + computeSaleProfit(s), 0),
    };

    return { tenantName: tenant.name, period: { from, to }, summary, sales };
  }
}
