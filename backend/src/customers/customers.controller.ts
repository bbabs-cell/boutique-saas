import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateCustomerDto,
  createCustomerSchema,
  CreateCustomerPaymentDto,
  createCustomerPaymentSchema,
  ListCustomersQueryDto,
  listCustomersQuerySchema,
  UpdateCustomerDto,
  updateCustomerSchema,
} from './dto/customers.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CAISSIER')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQueryDto,
  ) {
    return this.customersService.findAll(user.tenantId, query);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto,
  ) {
    return this.customersService.create(user.tenantId, dto);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CAISSIER')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @Post(':id/payments')
  @Roles('ADMIN', 'MANAGER')
  addPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCustomerPaymentSchema)) dto: CreateCustomerPaymentDto,
  ) {
    return this.customersService.addPayment(user.tenantId, user.userId, id, dto);
  }
}
