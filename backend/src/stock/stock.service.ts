import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { notifyStockLevel } from '../common/notifications-helper';
import { resolveActiveStoreId } from '../common/stores-helper';
import { dispatchWebhookEvent } from '../common/webhooks-helper';
import { CreateStockAdjustmentDto, ListStockMovementsQueryDto } from './dto/stock.dto';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async createAdjustment(tenantId: string, userId: string, role: string, dto: CreateStockAdjustmentDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, dto.storeId, false);

    let isLowStock = false;
    let resultingStock = 0;

    const movement = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: dto.productId, tenantId } });
      if (!product) {
        throw new NotFoundException('Produit introuvable.');
      }

      const inventory = await tx.inventory.findUnique({
        where: { productId_storeId: { productId: product.id, storeId: storeId! } },
      });
      const currentStock = inventory?.stock ?? 0;
      const nextStock = currentStock + dto.quantity;
      if (nextStock < 0) {
        throw new BadRequestException(
          `Cet ajustement ferait passer le stock en négatif (stock actuel : ${currentStock}).`,
        );
      }

      await tx.inventory.upsert({
        where: { productId_storeId: { productId: product.id, storeId: storeId! } },
        update: { stock: nextStock },
        create: { productId: product.id, storeId: storeId!, stock: nextStock },
      });

      await notifyStockLevel(tx, tenantId, {
        id: product.id,
        name: product.name,
        stock: nextStock,
        lowStockThreshold: product.lowStockThreshold,
      });
      isLowStock =
        nextStock <= 0 || (product.lowStockThreshold !== null && nextStock <= product.lowStockThreshold);
      resultingStock = nextStock;

      return tx.stockMovement.create({
        data: {
          tenantId,
          storeId: storeId!,
          productId: product.id,
          type: 'ADJUSTMENT',
          quantity: dto.quantity,
          reason: dto.reason ?? null,
          userId,
        },
        include: { product: true, store: true, user: { select: { id: true, name: true } } },
      });
    }, { timeout: 15000 });

    if (isLowStock) {
      // Dispatché seulement une fois la transaction validée.
      await dispatchWebhookEvent(this.prisma, tenantId, 'stock.low', {
        productId: movement.productId,
        productName: movement.product.name,
        storeId: movement.storeId,
        stock: resultingStock,
        lowStockThreshold: movement.product.lowStockThreshold,
      });
    }

    return movement;
  }

  async findMovements(tenantId: string, userId: string, role: string, query: ListStockMovementsQueryDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
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
      this.prisma.stockMovement.findMany({
        where,
        include: { product: true, store: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  async findAlerts(tenantId: string, userId: string, role: string, requestedStoreId?: string) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, true);

    const inventory = await this.prisma.inventory.findMany({
      where: {
        storeId: storeId ?? undefined,
        product: { tenantId, active: true, lowStockThreshold: { not: null } },
      },
      include: { product: { include: { category: true } }, store: true },
      orderBy: { stock: 'asc' },
    });

    return inventory
      .filter((inv) => inv.product.lowStockThreshold !== null && inv.stock <= inv.product.lowStockThreshold)
      .map((inv) => ({
        ...inv.product,
        stock: inv.stock,
        store: { id: inv.store.id, name: inv.store.name },
      }));
  }
}
