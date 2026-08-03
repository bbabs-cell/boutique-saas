import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveStoreId } from '../common/stores-helper';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, userId: string, role: string, query: ListProductsQueryDto) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, true);

    const where: Prisma.ProductWhereInput = {
      tenantId,
      active: true,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true, inventory: storeId ? { where: { storeId } } : true },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => this.withStock(p, storeId)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
      storeId,
    };
  }

  async findOne(tenantId: string, userId: string, role: string, id: string, requestedStoreId?: string) {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, true);

    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true, inventory: storeId ? { where: { storeId } } : true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }
    return this.withStock(product, storeId);
  }

  async findByBarcode(
    tenantId: string,
    userId: string,
    role: string,
    barcode: string,
    requestedStoreId?: string,
  ) {
    // Le scan en caisse a besoin d'un niveau de stock précis : pas de mode "toutes boutiques" ici.
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, false);

    const product = await this.prisma.product.findFirst({
      where: { tenantId, barcode, active: true },
      include: { category: true, inventory: { where: { storeId: storeId! } } },
    });
    if (!product) {
      throw new NotFoundException('Aucun produit avec ce code-barres.');
    }
    return this.withStock(product, storeId);
  }

  async create(tenantId: string, userId: string, role: string, dto: CreateProductDto, requestedStoreId?: string) {
    await this.assertBarcodeAvailable(tenantId, dto.barcode ?? null);
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, false);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        barcode: dto.barcode ?? null,
        price: dto.price,
        cost: dto.cost,
        lowStockThreshold: dto.lowStockThreshold ?? null,
        categoryId: dto.categoryId ?? null,
        tenantId,
        inventory: {
          create: { storeId: storeId!, stock: dto.stock ?? 0 },
        },
      },
      include: { category: true, inventory: true },
    });

    return this.withStock(product, storeId);
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException('Produit introuvable.');
    }

    if (dto.barcode !== undefined) {
      await this.assertBarcodeAvailable(tenantId, dto.barcode, id);
    }

    // Le stock ne se modifie plus ici : il est propre à chaque boutique et passe par le module Stock.
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
        ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      },
      include: { category: true },
    });
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException('Produit introuvable.');
    }
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  private async assertBarcodeAvailable(tenantId: string, barcode: string | null, excludeId?: string) {
    if (!barcode) return;
    const existing = await this.prisma.product.findFirst({
      where: { tenantId, barcode, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new ConflictException('Ce code-barres est déjà utilisé par un autre produit.');
    }
  }

  /**
   * Ajoute un champ `stock` calculé à un produit : le stock de la boutique active,
   * ou la somme sur toutes les boutiques si aucune boutique n'est active (vue ADMIN globale).
   * Générique pour que TypeScript préserve le type réel de chaque appelant (barcode, name…)
   * au lieu de le réduire au seul champ `inventory` déclaré dans la contrainte.
   */
  private withStock<T extends { inventory: { storeId: string; stock: number }[] }>(
    product: T,
    storeId: string | null,
  ): Omit<T, 'inventory'> & { stock: number } {
    const { inventory, ...rest } = product;
    const stock = storeId
      ? inventory.find((i) => i.storeId === storeId)?.stock ?? 0
      : inventory.reduce((sum, i) => sum + i.stock, 0);
    return { ...rest, stock } as Omit<T, 'inventory'> & { stock: number };
  }
}
