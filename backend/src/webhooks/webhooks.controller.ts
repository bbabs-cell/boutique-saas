import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateWebhookDto, createWebhookSchema } from './dto/webhooks.dto';

@Controller('settings/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.webhooksService.findAll(user.tenantId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWebhookSchema)) dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(user.tenantId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.webhooksService.remove(user.tenantId, id);
  }
}
