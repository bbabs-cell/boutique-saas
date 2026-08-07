import { Injectable } from '@nestjs/common';
import { buildWorkbookBuffer } from '../common/excel';

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
  async generateSalesReportExcel(report: ReportForExcel): Promise<Buffer> {
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

    return buildWorkbookBuffer([
      { name: 'Résumé', columns: ['Indicateur', 'Valeur'], rows: summaryRows },
      {
        name: 'Ventes',
        columns: ['Date', 'Vendeur', 'Client', 'Sous-total', 'Remise', 'TVA', 'Total'],
        rows: salesRows,
      },
    ]);
  }
}
