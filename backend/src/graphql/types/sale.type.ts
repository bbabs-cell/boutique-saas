import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SaleItem', { description: "Ligne d'une vente." })
export class SaleItemGqlType {
  @Field()
  productId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  unitPrice!: number;
}

@ObjectType('Sale', { description: 'Vente validée (lecture seule).' })
export class SaleGqlType {
  @Field()
  id!: string;

  @Field()
  storeId!: string;

  @Field(() => Int)
  subtotal!: number;

  @Field(() => Int)
  discount!: number;

  @Field(() => Int)
  tvaAmount!: number;

  @Field(() => Int)
  total!: number;

  @Field()
  createdAt!: Date;

  @Field(() => [SaleItemGqlType])
  items!: SaleItemGqlType[];
}

@ObjectType('PaginatedSales')
export class PaginatedSalesGqlType {
  @Field(() => [SaleGqlType])
  items!: SaleGqlType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
