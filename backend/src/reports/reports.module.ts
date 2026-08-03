import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsExcelService } from './reports-excel.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPdfService, ReportsExcelService],
})
export class ReportsModule {}
