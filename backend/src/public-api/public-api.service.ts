import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicPaginationQueryDto } from './dto/public-api.dto';

@Injectable()
export class PublicApiService {
  constructor(private prisma: PrismaService) {}

  async getProducts(tenantId: string, query: PublicPaginationQueryDto) {
    const where = { tenantId, active: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          barcode: true,
          price: true,
          cost: true,
          categoryId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return this.paginate(items, total, query);
  }

  async getSales(tenantId: string, query: PublicPaginationQueryDto) {
    const where = { tenantId, status: 'COMPLETED' as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        select: {
          id: true,
          storeId: true,
          subtotal: true,
          discount: true,
          tvaAmount: true,
          total: true,
          createdAt: true,
          items: {
            select: { productId: true, quantity: true, unitPrice: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return this.paginate(items, total, query);
  }

  async getStock(tenantId: string, query: PublicPaginationQueryDto) {
    const where = { product: { tenantId, active: true } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        select: {
          productId: true,
          storeId: true,
          stock: true,
          product: { select: { name: true } },
          store: { select: { name: true } },
        },
        orderBy: { productId: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return this.paginate(items, total, query);
  }

  private paginate<T>(items: T[], total: number, query: PublicPaginationQueryDto) {
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }
}
