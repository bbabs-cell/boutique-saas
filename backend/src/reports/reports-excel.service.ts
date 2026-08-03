import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

interface ReportSaleRow {
  createdAt: Date;
  total: number;
  subtotal: number;
  discount: number;
  tvaAmount: number;
  user: { name: string };
  customer: { name: string } | null;
}

interface ReportForExcel {
  summary: { revenue: number; salesCount: number; profit: number };
  sales: ReportSaleRow[];
}

@Injectable()
export class ReportsExcelService {
  generateSalesReportExcel(report: ReportForExcel): Buffer {
    const salesRows = report.sales.map((sale) => ({
      Date: sale.createdAt.toLocaleString('fr-FR'),
      Vendeur: sale.user.name,
      Client: sale.customer?.name ?? '',
      'Sous-total': sale.subtotal,
      Remise: sale.discount,
      TVA: sale.tvaAmount,
      Total: sale.total,
    }));

    const summaryRows = [
      { Indicateur: "Chiffre d'affaires", Valeur: report.summary.revenue },
      { Indicateur: 'Nombre de ventes', Valeur: report.summary.salesCount },
      { Indicateur: 'Bénéfice estimé', Valeur: report.summary.profit },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Résumé');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesRows), 'Ventes');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
