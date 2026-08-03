import { Injectable } from '@nestjs/common';
// pdfkit n'a pas de types officiels à jour pour cette version ; import require classique.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

interface ReportSaleLine {
  createdAt: Date;
  total: number;
  user: { name: string };
  customer: { name: string } | null;
}

interface ReportForPdf {
  tenantName: string;
  period: { from: Date; to: Date };
  summary: { revenue: number; salesCount: number; profit: number };
  sales: ReportSaleLine[];
}

function formatXOF(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

@Injectable()
export class ReportsPdfService {
  generateSalesReportPdf(report: ReportForPdf): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(report.tenantName, { align: 'left' });
      doc.fontSize(12).fillColor('#666').text('Rapport de ventes', { align: 'left' });
      doc
        .fontSize(9)
        .text(
          `Période : ${report.period.from.toLocaleDateString('fr-FR')} — ${report.period.to.toLocaleDateString('fr-FR')}`,
        );
      doc.moveDown(1);

      doc.fillColor('#000').fontSize(11);
      doc.text(`Chiffre d'affaires : ${formatXOF(report.summary.revenue)}`);
      doc.text(`Nombre de ventes : ${report.summary.salesCount}`);
      doc.text(`Bénéfice estimé : ${formatXOF(report.summary.profit)}`);
      doc.moveDown(1);

      doc.fontSize(11).text('Détail des ventes', { underline: true });
      doc.moveDown(0.5);

      const colX = { date: 40, vendor: 180, customer: 320, total: 460 };
      doc.fontSize(9).fillColor('#666');
      doc.text('Date', colX.date, doc.y, { continued: false });
      doc.text('Vendeur', colX.vendor, doc.y - doc.currentLineHeight());
      doc.text('Client', colX.customer, doc.y - doc.currentLineHeight());
      doc.text('Total', colX.total, doc.y - doc.currentLineHeight());
      doc.moveDown(0.5);
      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .strokeColor('#ccc')
        .stroke();
      doc.moveDown(0.3);

      doc.fillColor('#000').fontSize(9);
      if (report.sales.length === 0) {
        doc.text('Aucune vente sur cette période.', 40, doc.y);
      }
      for (const sale of report.sales) {
        if (doc.y > 780) {
          doc.addPage();
        }
        const y = doc.y;
        doc.text(sale.createdAt.toLocaleString('fr-FR'), colX.date, y, { width: 130 });
        doc.text(sale.user.name, colX.vendor, y, { width: 130 });
        doc.text(sale.customer?.name ?? '—', colX.customer, y, { width: 130 });
        doc.text(formatXOF(sale.total), colX.total, y, { width: 95 });
        doc.moveDown(0.6);
      }

      doc.end();
    });
  }
}
