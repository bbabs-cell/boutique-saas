import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UpgradeSubscriptionDto, upgradeSubscriptionSchema } from './dto/subscription.dto';

@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get()
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.getSubscription(user.tenantId);
  }

  @Post('upgrade')
  upgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(upgradeSubscriptionSchema)) dto: UpgradeSubscriptionDto,
  ) {
    return this.subscriptionService.requestUpgrade(user.tenantId, dto);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.listInvoices(user.tenantId);
  }
}
