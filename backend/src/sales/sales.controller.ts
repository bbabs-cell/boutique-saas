import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateSaleDto,
  createSaleSchema,
  ListSalesQueryDto,
  listSalesQuerySchema,
} from './dto/sales.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'CAISSIER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSaleDto,
  ) {
    return this.salesService.create(user.tenantId, user.userId, user.role, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CAISSIER')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listSalesQuerySchema)) query: ListSalesQueryDto,
  ) {
    return this.salesService.findAll(user.tenantId, user.userId, user.role, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CAISSIER')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.salesService.findOne(user.tenantId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'MANAGER')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.salesService.cancel(user.tenantId, id);
  }
}
