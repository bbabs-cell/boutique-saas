import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Query, Resolver } from '@nestjs/graphql';
import { PublicApiService } from '../public-api/public-api.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { PaginatedProductsGqlType } from './types/product.type';
import { PaginatedSalesGqlType } from './types/sale.type';
import { PaginatedStockLevelsGqlType, StockLevelGqlType } from './types/stock-level.type';

interface GqlRequest {
  tenantId: string;
}

@Resolver()
@UseGuards(ApiKeyGuard)
export class PublicApiResolver {
  constructor(private publicApiService: PublicApiService) {}

  @Query(() => PaginatedProductsGqlType, { description: 'Catalogue produits (lecture seule).' })
  async products(
    @Context('req') req: GqlRequest,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize: number,
  ) {
    return this.publicApiService.getProducts(req.tenantId, { page, pageSize });
  }

  @Query(() => PaginatedSalesGqlType, { description: 'Ventes validées (lecture seule).' })
  async sales(
    @Context('req') req: GqlRequest,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize: number,
  ) {
    return this.publicApiService.getSales(req.tenantId, { page, pageSize });
  }

  @Query(() => PaginatedStockLevelsGqlType, {
    description: 'Niveaux de stock par boutique (lecture seule).',
  })
  async stock(
    @Context('req') req: GqlRequest,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize: number,
  ): Promise<PaginatedStockLevelsGqlType> {
    const result = await this.publicApiService.getStock(req.tenantId, { page, pageSize });
    const items: StockLevelGqlType[] = result.items.map((row: any) => ({
      productId: row.productId,
      productName: row.product.name,
      storeId: row.storeId,
      storeName: row.store.name,
      stock: row.stock,
    }));
    return { ...result, items };
  }
}
