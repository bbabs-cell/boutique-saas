import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, ListExpensesQueryDto, UpdateExpenseDto } from './dto/expenses.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListExpensesQueryDto) {
    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  create(tenantId: string, userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        tenantId,
        userId,
        label: dto.label,
        amount: dto.amount,
        category: dto.category ?? null,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    await this.assertExists(tenantId, id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.assertExists(tenantId, id);
    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  private async assertExists(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!expense) {
      throw new NotFoundException('Dépense introuvable.');
    }
    return expense;
  }
}
