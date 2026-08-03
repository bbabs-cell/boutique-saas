import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  BootstrapQueryDto,
  bootstrapQuerySchema,
  SyncSalesBatchDto,
  syncSalesBatchSchema,
} from './dto/sync.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'CAISSIER')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Get('bootstrap')
  bootstrap(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(bootstrapQuerySchema)) query: BootstrapQueryDto,
  ) {
    return this.syncService.bootstrap(user.tenantId, user.userId, user.role, query);
  }

  @Post('sales')
  syncSales(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(syncSalesBatchSchema)) dto: SyncSalesBatchDto,
  ) {
    return this.syncService.processSalesBatch(user.tenantId, user.userId, user.role, dto.sales);
  }
}
