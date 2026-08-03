import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductsExcelService],
})
export class ProductsModule {}
