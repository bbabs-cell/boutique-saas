import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  CreateCustomerPaymentDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './dto/customers.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListCustomersQueryDto) {
    const where: Prisma.CustomerWhereInput = {
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
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone ?? null,
        creditLimit: dto.creditLimit ?? null,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } }, payments: true },
        },
        payments: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Client introuvable.');
    }
    return customer;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.assertExists(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.creditLimit !== undefined ? { creditLimit: dto.creditLimit } : {}),
      },
    });
  }

  async addPayment(tenantId: string, userId: string, id: string, dto: CreateCustomerPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, tenantId } });
      if (!customer) {
        throw new NotFoundException('Client introuvable.');
      }
      if (dto.amount > customer.creditBalance) {
        throw new BadRequestException(
          `Le règlement (${dto.amount}) dépasse la dette actuelle du client (${customer.creditBalance}).`,
        );
      }

      await tx.customer.update({
        where: { id },
        data: { creditBalance: { decrement: dto.amount } },
      });

      await tx.notification.create({
        data: {
          tenantId,
          userId: null,
          type: 'PAYMENT_RECEIVED',
          message: `Règlement reçu de ${customer.name} : ${dto.amount} FCFA.`,
        },
      });

      return tx.customerPayment.create({
        data: {
          tenantId,
          customerId: id,
          amount: dto.amount,
          method: dto.method,
          userId,
        },
        include: { user: { select: { id: true, name: true } } },
      });
    }, { timeout: 15000 });
  }

  private async assertExists(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) {
      throw new NotFoundException('Client introuvable.');
    }
    return customer;
  }
}
