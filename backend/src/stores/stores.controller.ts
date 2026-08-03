import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanLimitGuard } from '../common/guards/plan-limit.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanLimitResource } from '../common/decorators/plan.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AssignUserDto,
  assignUserSchema,
  CreateStoreDto,
  createStoreSchema,
  UpdateStoreDto,
  updateStoreSchema,
} from './dto/stores.dto';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findAll(user.tenantId);
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  @PlanLimitResource('stores')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createStoreSchema)) dto: CreateStoreDto,
  ) {
    return this.storesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStoreSchema)) dto: UpdateStoreDto,
  ) {
    return this.storesService.update(user.tenantId, id, dto);
  }

  @Post(':id/users')
  assignUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignUserSchema)) dto: AssignUserDto,
  ) {
    return this.storesService.assignUser(user.tenantId, id, dto);
  }

  @Delete(':id/users/:userId')
  unassignUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.storesService.unassignUser(user.tenantId, id, userId);
  }
}
