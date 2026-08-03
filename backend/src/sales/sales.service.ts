import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { notifyStockLevel } from '../common/notifications-helper';
import { resolveActiveStoreId } from '../common/stores-helper';
import { dispatchPendingWebhookEvents, WebhookEvent } from '../common/webhooks-helper';
import { CreateSaleDto, ListSalesQueryDto } from './dto/sales.dto';

const SALE_INCLUDE = {
  items: { include: { product: true } },
  payments: true,
  user: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  store: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, userId: string, role: string, dto: CreateSaleDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, dto.storeId, false);

    // Regroupe les lignes portant sur le même produit pour valider correctement le stock,
    // même si le panier envoyé contient plusieurs lignes pour un même article.
    const quantityByProduct = new Map<string, number>();
    for (const item of dto.items) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const creditAmount = dto.payments
      .filter((p) => p.method === 'CREDIT')
      .reduce((sum, p) => sum + p.amount, 0);

    if (creditAmount > 0 && !dto.customerId) {
      throw new BadRequestException('Une vente à crédit doit être associée à un client.');
    }

    const pendingWebhookEvents: WebhookEvent[] = [];

    const sale = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });

      const products = await tx.product.findMany({
        where: { tenantId, id: { in: [...quantityByProduct.keys()] }, active: true },
      });
      const productsById = new Map(products.map((p) => [p.id, p]));

      const inventoryRows = await tx.inventory.findMany({
        where: { storeId: storeId!, productId: { in: [...quantityByProduct.keys()] } },
      });
      const stockByProduct = new Map(inventoryRows.map((i) => [i.productId, i.stock]));

      for (const [productId, quantity] of quantityByProduct) {
        const product = productsById.get(productId);
        if (!product) {
          throw new BadRequestException(`Produit introuvable dans le catalogue de la boutique.`);
        }
        const currentStock = stockByProduct.get(productId) ?? 0;
        if (currentStock < quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour « ${product.name} » (disponible : ${currentStock}, demandé : ${quantity}).`,
          );
        }
      }

      const subtotal = dto.items.reduce((sum, item) => {
        const product = productsById.get(item.productId)!;
        return sum + product.price * item.quantity;
      }, 0);

      if (dto.discount > subtotal) {
        throw new BadRequestException('La remise ne peut pas dépasser le sous-total.');
      }

      const taxableBase = subtotal - dto.discount;
      const tvaAmount = tenant.tvaEnabled ? Math.round((taxableBase * tenant.tvaRate) / 100) : 0;
      const total = taxableBase + tvaAmount;

      const paymentsTotal = dto.payments.reduce((sum, p) => sum + p.amount, 0);
      if (paymentsTotal < total) {
        throw new BadRequestException(
          `Le total des paiements (${paymentsTotal}) est inférieur au total de la vente (${total}).`,
        );
      }

      let customer = null;
      if (dto.customerId) {
        customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } });
        if (!customer) {
          throw new BadRequestException('Client introuvable dans cette boutique.');
        }
        if (creditAmount > 0 && customer.creditLimit !== null) {
          const nextBalance = customer.creditBalance + creditAmount;
          if (nextBalance > customer.creditLimit) {
            throw new BadRequestException(
              `Cette vente à crédit dépasserait le plafond autorisé pour ${customer.name} ` +
                `(dette actuelle : ${customer.creditBalance}, plafond : ${customer.creditLimit}).`,
            );
          }
        }
      }

      // Décrémente le stock de chaque produit (dans l'Inventory de cette boutique uniquement)
      // et journalise un mouvement de type SALE par produit.
      for (const [productId, quantity] of quantityByProduct) {
        const updatedInventory = await tx.inventory.update({
          where: { productId_storeId: { productId, storeId: storeId! } },
          data: { stock: { decrement: quantity } },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId: storeId!,
            productId,
            type: 'SALE',
            quantity: -quantity,
            userId,
          },
        });
        const product = productsById.get(productId)!;
        await notifyStockLevel(tx, tenantId, {
          id: product.id,
          name: product.name,
          stock: updatedInventory.stock,
          lowStockThreshold: product.lowStockThreshold,
        });
        if (
          updatedInventory.stock <= 0 ||
          (product.lowStockThreshold !== null && updatedInventory.stock <= product.lowStockThreshold)
        ) {
          pendingWebhookEvents.push({
            event: 'stock.low',
            payload: {
              productId: product.id,
              productName: product.name,
              storeId: storeId!,
              stock: updatedInventory.stock,
              lowStockThreshold: product.lowStockThreshold,
            },
          });
        }
      }

      if (creditAmount > 0 && customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { creditBalance: { increment: creditAmount } },
        });
      }

      const sale = await tx.sale.create({
        data: {
          tenantId,
          storeId: storeId!,
          userId,
          customerId: dto.customerId ?? null,
          subtotal,
          discount: dto.discount,
          tvaAmount,
          total,
          clientId: dto.clientId ?? null,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productsById.get(item.productId)!.price,
              unitCost: productsById.get(item.productId)!.cost,
            })),
          },
          payments: {
            create: dto.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference ?? null,
            })),
          },
        },
        include: SALE_INCLUDE,
      });

      pendingWebhookEvents.push({
        event: 'sale.created',
        payload: {
          saleId: sale.id,
          storeId: sale.storeId,
          total: sale.total,
          itemCount: sale.items.length,
          createdAt: sale.createdAt,
        },
      });

      return sale;
    }, { timeout: 15000 });

    // Dispatché seulement une fois la transaction validée : un appel HTTP sortant ne doit
    // jamais retenir un verrou de base de données.
    await dispatchPendingWebhookEvents(this.prisma, tenantId, pendingWebhookEvents);

    return sale;
  }

  async findAll(tenantId: string, userId: string, role: string, query: ListSalesQueryDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
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
      this.prisma.sale.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  async findOne(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: SALE_INCLUDE,
    });
    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }
    return sale;
  }

  async cancel(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: { items: true, payments: true },
      });
      if (!sale) {
        throw new NotFoundException('Vente introuvable.');
      }
      if (sale.status === 'CANCELLED') {
        throw new ForbiddenException('Cette vente est déjà annulée.');
      }

      for (const item of sale.items) {
        await tx.inventory.upsert({
          where: { productId_storeId: { productId: item.productId, storeId: sale.storeId } },
          update: { stock: { increment: item.quantity } },
          create: { productId: item.productId, storeId: sale.storeId, stock: item.quantity },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId: sale.storeId,
            productId: item.productId,
            type: 'RESTOCK',
            quantity: item.quantity,
            reason: `Annulation de la vente ${sale.id}`,
            userId: sale.userId,
          },
        });
      }

      // Si la vente comportait un paiement à crédit, la dette du client est annulée avec la vente.
      const creditAmount = sale.payments
        .filter((p) => p.method === 'CREDIT')
        .reduce((sum, p) => sum + p.amount, 0);
      if (creditAmount > 0 && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { creditBalance: { decrement: creditAmount } },
        });
      }

      return tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: SALE_INCLUDE,
      });
    }, { timeout: 15000 });
  }
}
