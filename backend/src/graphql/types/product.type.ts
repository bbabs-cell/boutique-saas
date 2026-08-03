import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Product', { description: 'Produit du catalogue (lecture seule).' })
export class ProductGqlType {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  barcode?: string | null;

  @Field(() => Int)
  price!: number;

  @Field(() => Int)
  cost!: number;

  @Field(() => String, { nullable: true })
  categoryId?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType('PaginatedProducts')
export class PaginatedProductsGqlType {
  @Field(() => [ProductGqlType])
  items!: ProductGqlType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
