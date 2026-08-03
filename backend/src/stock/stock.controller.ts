import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateStockAdjustmentDto,
  createStockAdjustmentSchema,
  ListStockMovementsQueryDto,
  listStockMovementsQuerySchema,
} from './dto/stock.dto';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'MAGASINIER')
export class StockController {
  constructor(private stockService: StockService) {}

  @Post('adjustments')
  createAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createStockAdjustmentSchema)) dto: CreateStockAdjustmentDto,
  ) {
    return this.stockService.createAdjustment(user.tenantId, user.userId, user.role, dto);
  }

  @Get('movements')
  findMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listStockMovementsQuerySchema)) query: ListStockMovementsQueryDto,
  ) {
    return this.stockService.findMovements(user.tenantId, user.userId, user.role, query);
  }

  @Get('alerts')
  findAlerts(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.stockService.findAlerts(user.tenantId, user.userId, user.role, storeId);
  }
}
