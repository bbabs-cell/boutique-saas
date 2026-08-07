import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsExcelService } from './reports-excel.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SalesReportQueryDto, salesReportQuerySchema } from './dto/reports.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private reportsPdfService: ReportsPdfService,
    private reportsExcelService: ReportsExcelService,
  ) {}

  @Get('sales')
  getSalesReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(salesReportQuerySchema)) query: SalesReportQueryDto,
  ) {
    return this.reportsService.getSalesReport(user.tenantId, user.userId, user.role, query);
  }

  @Get('sales/pdf')
  async getSalesReportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(salesReportQuerySchema)) query: SalesReportQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.getSalesReport(user.tenantId, user.userId, user.role, query);
    const pdf = await this.reportsPdfService.generateSalesReportPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-ventes.pdf"');
    res.send(pdf);
  }

  @Get('sales/excel')
  async getSalesReportExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(salesReportQuerySchema)) query: SalesReportQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.getSalesReport(user.tenantId, user.userId, user.role, query);
    const excel = await this.reportsExcelService.generateSalesReportExcel(report);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="rapport-ventes.xlsx"');
    res.send(excel);
  }
}
