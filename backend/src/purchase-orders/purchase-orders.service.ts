import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveStoreId } from '../common/stores-helper';
import {
  CreatePurchaseOrderDto,
  ListPurchaseOrdersQueryDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-orders.dto';

const PO_INCLUDE = {
  items: { include: { product: true } },
  supplier: { select: { id: true, name: true, phone: true } },
  user: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
} satisfies Prisma.PurchaseOrderInclude;

function computeTotal(items: { quantity: number; unitCost: number }[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
}

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, userId: string, role: string, query: ListPurchaseOrdersQueryDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: PO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  async create(tenantId: string, userId: string, role: string, dto: CreatePurchaseOrderDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, dto.storeId, false);

    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } });
    if (!supplier) {
      throw new BadRequestException('Fournisseur introuvable dans cette boutique.');
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: dto.items.map((i) => i.productId) } },
    });
    if (products.length !== new Set(dto.items.map((i) => i.productId)).size) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables dans cette boutique.');
    }

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        storeId: storeId!,
        supplierId: dto.supplierId,
        userId,
        status: dto.status,
        total: computeTotal(dto.items),
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      include: PO_INCLUDE,
    });
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: PO_INCLUDE });
    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }
    return order;
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const order = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }
    if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Cette commande ne peut plus être modifiée.');
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } });
      if (!supplier) {
        throw new BadRequestException('Fournisseur introuvable dans cette boutique.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: dto.items.map((item) => ({
            purchaseOrderId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.items ? { total: computeTotal(dto.items) } : {}),
        },
        include: PO_INCLUDE,
      });
    }, { timeout: 15000 });
  }

  async receive(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Commande introuvable.');
      }
      if (order.status === 'RECEIVED') {
        throw new BadRequestException('Cette commande a déjà été reçue.');
      }
      if (order.status === 'CANCELLED') {
        throw new BadRequestException('Cette commande est annulée et ne peut pas être reçue.');
      }

      for (const item of order.items) {
        // Le stock reçu est crédité dans l'Inventory de la boutique qui a passé la commande.
        await tx.inventory.upsert({
          where: { productId_storeId: { productId: item.productId, storeId: order.storeId } },
          update: { stock: { increment: item.quantity } },
          create: { productId: item.productId, storeId: order.storeId, stock: item.quantity },
        });
        // Le coût catalogue (Product.cost) reste global au tenant : dernier coût d'achat connu,
        // quelle que soit la boutique qui a reçu la commande.
        await tx.product.update({
          where: { id: item.productId },
          data: { cost: item.unitCost },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId: order.storeId,
            productId: item.productId,
            type: 'RESTOCK',
            quantity: item.quantity,
            reason: `Réception commande fournisseur ${order.id}`,
            userId: order.userId,
          },
        });
      }

      await tx.supplier.update({
        where: { id: order.supplierId },
        data: { balance: { increment: order.total } },
      });

      return tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
        include: PO_INCLUDE,
      });
    }, { timeout: 15000 });
  }
}
