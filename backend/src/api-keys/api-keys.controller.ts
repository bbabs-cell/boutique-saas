import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanFeatureRequired } from '../common/decorators/plan.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateApiKeyDto, createApiKeySchema } from './dto/api-keys.dto';

@Controller('settings/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeysService.findAll(user.tenantId);
  }

  // Seule la création est conditionnée au plan. Lister et révoquer restent accessibles quel
  // que soit le plan : un tenant qui redescend doit garder le moyen de reprendre la main sur
  // les clés qu'il a déjà émises.
  @Post()
  @UseGuards(PlanFeatureGuard)
  @PlanFeatureRequired('publicApi')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApiKeySchema)) dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.tenantId, dto);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.tenantId, id);
  }
}
