import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantPlanLimits } from '../common/plan-limits';
import { resolveActiveStoreId } from '../common/stores-helper';

const COLUMNS = ['Nom', 'Code-barres', 'Prix', 'Coût', 'Stock', 'Seuil alerte', 'Catégorie'] as const;

interface ImportRowResult {
  row: number;
  name: string;
  action: 'created' | 'updated';
}
interface ImportRowError {
  row: number;
  message: string;
}

@Injectable()
export class ProductsExcelService {
  constructor(private prisma: PrismaService) {}

  async exportCatalog(
    tenantId: string,
    userId: string,
    role: string,
    requestedStoreId?: string,
  ): Promise<Buffer> {
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, true);

    const products = await this.prisma.product.findMany({
      where: { tenantId, active: true },
      include: { category: true, inventory: storeId ? { where: { storeId } } : true },
      orderBy: { name: 'asc' },
    });

    const rows = products.map((p) => {
      const stock = storeId
        ? p.inventory.find((i) => i.storeId === storeId)?.stock ?? 0
        : p.inventory.reduce((sum, i) => sum + i.stock, 0);
      return {
        Nom: p.name,
        'Code-barres': p.barcode ?? '',
        Prix: p.price,
        Coût: p.cost,
        Stock: stock,
        'Seuil alerte': p.lowStockThreshold ?? '',
        Catégorie: p.category?.name ?? '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produits');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async importCatalog(
    tenantId: string,
    userId: string,
    role: string,
    file?: Express.Multer.File,
    requestedStoreId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    // L'import cible toujours une boutique précise : le stock importé y est appliqué.
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, requestedStoreId, false);

    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      throw new BadRequestException('Fichier Excel illisible. Vérifiez le format (.xlsx).');
    }

    const created: ImportRowResult[] = [];
    const updated: ImportRowResult[] = [];
    const errors: ImportRowError[] = [];

    // La limite de produits du plan s'applique ici comme sur la création à l'unité : sans ce
    // contrôle, l'import était le chemin le plus simple pour la contourner entièrement.
    // Seules les créations comptent — mettre à jour un produit existant ne consomme pas de quota.
    const { maxProducts } = await getTenantPlanLimits(this.prisma, tenantId);
    let remainingQuota =
      maxProducts === null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, maxProducts - (await this.prisma.product.count({ where: { tenantId, active: true } })));

    // Séquentiel (pas dans une seule transaction) : un import volumineux ne doit pas
    // échouer entièrement à cause d'une seule ligne invalide.
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 pour l'en-tête, +1 pour l'index 0-based
      const row = rows[i];
      try {
        const name = String(row['Nom'] ?? '').trim();
        if (!name) {
          throw new Error('Le nom du produit est requis.');
        }
        const barcodeRaw = String(row['Code-barres'] ?? '').trim();
        const barcode = barcodeRaw || null;
        const price = Math.round(Number(row['Prix']) || 0);
        const cost = Math.round(Number(row['Coût']) || 0);
        const stock = Math.round(Number(row['Stock']) || 0);
        const thresholdRaw = row['Seuil alerte'];
        const lowStockThreshold =
          thresholdRaw !== '' && thresholdRaw !== undefined && thresholdRaw !== null
            ? Math.round(Number(thresholdRaw))
            : null;
        const categoryName = String(row['Catégorie'] ?? '').trim();

        let categoryId: string | null = null;
        if (categoryName) {
          const category = await this.prisma.category.upsert({
            where: { tenantId_name: { tenantId, name: categoryName } },
            update: {},
            create: { tenantId, name: categoryName },
          });
          categoryId = category.id;
        }

        // Correspondance par code-barres, puis par nom.
        let existing = barcode
          ? await this.prisma.product.findFirst({ where: { tenantId, barcode } })
          : null;
        if (!existing) {
          existing = await this.prisma.product.findFirst({
            where: { tenantId, name: { equals: name, mode: 'insensitive' } },
          });
        }

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: { name, barcode, price, cost, lowStockThreshold, categoryId },
          });
          await this.prisma.inventory.upsert({
            where: { productId_storeId: { productId: existing.id, storeId: storeId! } },
            update: { stock },
            create: { productId: existing.id, storeId: storeId!, stock },
          });
          updated.push({ row: rowNumber, name, action: 'updated' });
        } else {
          if (remainingQuota <= 0) {
            throw new Error(
              `Limite de ${maxProducts} produits atteinte pour votre plan. ` +
                'Passez à un plan supérieur pour importer davantage de produits.',
            );
          }
          const product = await this.prisma.product.create({
            data: {
              tenantId,
              name,
              barcode,
              price,
              cost,
              lowStockThreshold,
              categoryId,
              inventory: { create: { storeId: storeId!, stock } },
            },
          });
          remainingQuota -= 1;
          created.push({ row: rowNumber, name: product.name, action: 'created' });
        }
      } catch (err) {
        errors.push({ row: rowNumber, message: err instanceof Error ? err.message : 'Ligne invalide.' });
      }
    }

    return {
      createdCount: created.length,
      updatedCount: updated.length,
      errorCount: errors.length,
      errors,
    };
  }
}
