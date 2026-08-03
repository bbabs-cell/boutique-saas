import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateSupplierDto,
  createSupplierSchema,
  CreateSupplierPaymentDto,
  createSupplierPaymentSchema,
  ListSuppliersQueryDto,
  listSuppliersQuerySchema,
  UpdateSupplierDto,
  updateSupplierSchema,
} from './dto/suppliers.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'MAGASINIER')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listSuppliersQuerySchema)) query: ListSuppliersQueryDto,
  ) {
    return this.suppliersService.findAll(user.tenantId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplierDto,
  ) {
    return this.suppliersService.create(user.tenantId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.suppliersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.tenantId, id, dto);
  }

  @Post(':id/payments')
  addPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createSupplierPaymentSchema)) dto: CreateSupplierPaymentDto,
  ) {
    return this.suppliersService.addPayment(user.tenantId, user.userId, id, dto);
  }
}
