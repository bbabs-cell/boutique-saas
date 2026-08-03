import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('StockLevel', { description: "Niveau de stock d'un produit dans une boutique (lecture seule)." })
export class StockLevelGqlType {
  @Field()
  productId!: string;

  @Field()
  productName!: string;

  @Field()
  storeId!: string;

  @Field()
  storeName!: string;

  @Field(() => Int)
  stock!: number;
}

@ObjectType('PaginatedStockLevels')
export class PaginatedStockLevelsGqlType {
  @Field(() => [StockLevelGqlType])
  items!: StockLevelGqlType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
