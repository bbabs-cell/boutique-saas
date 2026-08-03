import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlanFeatureRequired } from '../common/decorators/plan.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateExpenseDto,
  createExpenseSchema,
  ListExpensesQueryDto,
  listExpensesQuerySchema,
  UpdateExpenseDto,
  updateExpenseSchema,
} from './dto/expenses.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard, PlanFeatureGuard)
@Roles('ADMIN')
@PlanFeatureRequired('accounting')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listExpensesQuerySchema)) query: ListExpensesQueryDto,
  ) {
    return this.expensesService.findAll(user.tenantId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expensesService.remove(user.tenantId, id);
  }
}
