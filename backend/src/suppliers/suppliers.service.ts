import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  CreateSupplierPaymentDto,
  ListSuppliersQueryDto,
  UpdateSupplierDto,
} from './dto/suppliers.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListSuppliersQueryDto) {
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  create(tenantId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { tenantId, name: dto.name, phone: dto.phone ?? null },
    });
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } },
        },
        payments: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
    return supplier;
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    await this.assertExists(tenantId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
  }

  async addPayment(tenantId: string, userId: string, id: string, dto: CreateSupplierPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id, tenantId } });
      if (!supplier) {
        throw new NotFoundException('Fournisseur introuvable.');
      }
      if (dto.amount > supplier.balance) {
        throw new BadRequestException(
          `Le règlement (${dto.amount}) dépasse la dette actuelle envers ce fournisseur (${supplier.balance}).`,
        );
      }

      await tx.supplier.update({
        where: { id },
        data: { balance: { decrement: dto.amount } },
      });

      return tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId: id,
          amount: dto.amount,
          method: dto.method,
          userId,
        },
        include: { user: { select: { id: true, name: true } } },
      });
    }, { timeout: 15000 });
  }

  private async assertExists(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) {
      throw new NotFoundException('Fournisseur introuvable.');
    }
    return supplier;
  }
}
