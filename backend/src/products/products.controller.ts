import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { MAX_CATALOG_IMPORT_SIZE_BYTES, SINGLE_FILE_UPLOAD } from '../common/upload-limits';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanLimitGuard } from '../common/guards/plan-limit.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanLimitResource } from '../common/decorators/plan.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateProductDto,
  createProductSchema,
  ListProductsQueryDto,
  listProductsQuerySchema,
  UpdateProductDto,
  updateProductSchema,
} from './dto/products.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private productsExcelService: ProductsExcelService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listProductsQuerySchema)) query: ListProductsQueryDto,
  ) {
    return this.productsService.findAll(user.tenantId, user.userId, user.role, query);
  }

  // Doit être déclaré avant ":id" pour éviter que "barcode"/"export" soient interprétés comme un id.
  @Get('barcode/:code')
  findByBarcode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.productsService.findByBarcode(user.tenantId, user.userId, user.role, code, storeId);
  }

  @Get('export')
  async exportCatalog(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('storeId') storeId?: string,
  ) {
    const buffer = await this.productsExcelService.exportCatalog(user.tenantId, user.userId, user.role, storeId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="catalogue-produits.xlsx"');
    res.send(buffer);
  }

  // Comme pour le logo : la limite doit être posée sur l'interceptor, sinon multer bufferise
  // tout le fichier en mémoire avant qu'on puisse le refuser.
  @Post('import')
  @Roles('ADMIN', 'MANAGER', 'MAGASINIER')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CATALOG_IMPORT_SIZE_BYTES, files: SINGLE_FILE_UPLOAD },
    }),
  )
  importCatalog(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
    @Query('storeId') storeId?: string,
  ) {
    return this.productsExcelService.importCatalog(user.tenantId, user.userId, user.role, file, storeId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.productsService.findOne(user.tenantId, user.userId, user.role, id, storeId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'MAGASINIER')
  @UseGuards(PlanLimitGuard)
  @PlanLimitResource('products')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto,
  ) {
    return this.productsService.create(user.tenantId, user.userId, user.role, dto, dto.storeId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'MAGASINIER')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'MAGASINIER')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.softDelete(user.tenantId, id);
  }
}
