import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  RecentActivityQueryDto,
  recentActivityQuerySchema,
  TopProductsQueryDto,
  topProductsQuerySchema,
} from './dto/dashboard.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.dashboardService.getSummary(user.tenantId, user.userId, user.role, storeId);
  }

  @Get('revenue-chart')
  getRevenueChart(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.dashboardService.getRevenueChart(user.tenantId, user.userId, user.role, storeId);
  }

  @Get('top-products')
  getTopProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(topProductsQuerySchema)) query: TopProductsQueryDto,
  ) {
    return this.dashboardService.getTopProducts(user.tenantId, user.userId, user.role, query);
  }

  @Get('recent-activity')
  getRecentActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(recentActivityQuerySchema)) query: RecentActivityQueryDto,
  ) {
    return this.dashboardService.getRecentActivity(user.tenantId, user.userId, user.role, query);
  }
}
