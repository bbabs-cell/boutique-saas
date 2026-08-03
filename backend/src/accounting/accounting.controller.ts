import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanFeatureRequired } from '../common/decorators/plan.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AccountingSummaryQueryDto, accountingSummaryQuerySchema } from './dto/accounting.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard, PlanFeatureGuard)
@Roles('ADMIN')
@PlanFeatureRequired('accounting')
export class AccountingController {
  constructor(private accountingService: AccountingService) {}

  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(accountingSummaryQuerySchema)) query: AccountingSummaryQueryDto,
  ) {
    return this.accountingService.getSummary(user.tenantId, query);
  }
}
