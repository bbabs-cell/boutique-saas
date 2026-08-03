import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreatePurchaseOrderDto,
  createPurchaseOrderSchema,
  ListPurchaseOrdersQueryDto,
  listPurchaseOrdersQuerySchema,
  UpdatePurchaseOrderDto,
  updatePurchaseOrderSchema,
} from './dto/purchase-orders.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'MAGASINIER')
export class PurchaseOrdersController {
  constructor(private purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listPurchaseOrdersQuerySchema)) query: ListPurchaseOrdersQueryDto,
  ) {
    return this.purchaseOrdersService.findAll(user.tenantId, user.userId, user.role, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPurchaseOrderSchema)) dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.create(user.tenantId, user.userId, user.role, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseOrdersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePurchaseOrderSchema)) dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(user.tenantId, id, dto);
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseOrdersService.receive(user.tenantId, id);
  }
}
