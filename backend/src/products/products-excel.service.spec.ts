import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import { ProductsExcelService } from './products-excel.service';

function buildPrismaMock() {
  return {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // Nombre de produits déjà présents, pour le quota du plan appliqué à l'import.
      count: vi.fn().mockResolvedValue(0),
    },
    category: { upsert: vi.fn() },
    inventory: { upsert: vi.fn() },
    store: { findFirst: vi.fn(), findMany: vi.fn() },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
    // Plan sans limite de produits par défaut : les tests qui vérifient le quota le redéfinissent.
    subscription: { findUnique: vi.fn().mockResolvedValue({ plan: 'BUSINESS' }), create: vi.fn() },
  };
}

function buildXlsxFile(rows: Record<string, unknown>[]): Express.Multer.File {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produits');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { buffer, originalname: 'catalogue.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as any;
}

describe('ProductsExcelService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ProductsExcelService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ProductsExcelService(prisma as any);
  });

  describe('exportCatalog', () => {
    it('génère un classeur Excel avec le stock de la boutique active', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.product.findMany.mockResolvedValue([
        {
          name: 'Riz 5kg',
          barcode: '123456',
          price: 5000,
          cost: 4000,
          lowStockThreshold: 5,
          category: { name: 'Alimentation' },
          inventory: [{ storeId: 's1', stock: 10 }],
        },
      ]);

      const buffer = await service.exportCatalog('tenant-1', 'admin-1', 'ADMIN', 's1');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      expect(rows).toHaveLength(1);
      expect(rows[0]['Nom']).toBe('Riz 5kg');
      expect(rows[0]['Stock']).toBe(10);
      expect(rows[0]['Catégorie']).toBe('Alimentation');
    });
  });

  describe('importCatalog', () => {
    it('refuse un import sans fichier', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });

      await expect(
        service.importCatalog('tenant-1', 'admin-1', 'ADMIN', undefined, 's1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('crée un nouveau produit avec un stock initial pour la boutique active', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.category.upsert.mockResolvedValue({ id: 'cat-1', name: 'Alimentation' });
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p1', name: 'Sucre 1kg' });

      const file = buildXlsxFile([
        {
          Nom: 'Sucre 1kg',
          'Code-barres': '999999',
          Prix: 1200,
          Coût: 900,
          Stock: 20,
          'Seuil alerte': 5,
          Catégorie: 'Alimentation',
        },
      ]);

      const result = await service.importCatalog('tenant-1', 'admin-1', 'ADMIN', file, 's1');

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Sucre 1kg',
            barcode: '999999',
            categoryId: 'cat-1',
            inventory: { create: { storeId: 's1', stock: 20 } },
          }),
        }),
      );
      expect(result.createdCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('met à jour un produit existant (trouvé par code-barres) et son Inventory pour la boutique active — pas de doublon', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.category.upsert.mockResolvedValue({ id: 'cat-1', name: 'Alimentation' });
      prisma.product.findFirst.mockResolvedValue({ id: 'existing-1', barcode: '999999' });
      prisma.product.update.mockResolvedValue({ id: 'existing-1' });

      const file = buildXlsxFile([
        { Nom: 'Sucre 1kg', 'Code-barres': '999999', Prix: 1300, Coût: 900, Stock: 15, 'Seuil alerte': '', Catégorie: '' },
      ]);

      const result = await service.importCatalog('tenant-1', 'admin-1', 'ADMIN', file, 's1');

      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-1' } }),
      );
      expect(prisma.inventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId_storeId: { productId: 'existing-1', storeId: 's1' } },
          update: { stock: 15 },
        }),
      );
      expect(result.updatedCount).toBe(1);
      expect(result.createdCount).toBe(0);
    });

    it('signale une erreur de ligne sans interrompre les lignes suivantes', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p2', name: 'Produit valide' });

      const file = buildXlsxFile([
        { Nom: '', Prix: 1000, Coût: 800, Stock: 1 }, // nom manquant → erreur
        { Nom: 'Produit valide', Prix: 1000, Coût: 800, Stock: 1 },
      ]);

      const result = await service.importCatalog('tenant-1', 'admin-1', 'ADMIN', file, 's1');

      expect(result.errorCount).toBe(1);
      expect(result.createdCount).toBe(1);
    });

    it("respecte la limite de produits du plan — l'import ne doit pas être une porte dérobée", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p1', name: 'Produit' });
      // Plan Gratuit : 50 produits, dont 49 déjà créés → une seule création possible.
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.product.count.mockResolvedValue(49);

      const file = buildXlsxFile([
        { Nom: 'Produit A', Prix: 1000, Coût: 800, Stock: 1 },
        { Nom: 'Produit B', Prix: 1000, Coût: 800, Stock: 1 },
        { Nom: 'Produit C', Prix: 1000, Coût: 800, Stock: 1 },
      ]);

      const result = await service.importCatalog('tenant-1', 'admin-1', 'ADMIN', file, 's1');

      expect(result.createdCount).toBe(1);
      expect(result.errorCount).toBe(2);
      expect(result.errors[0].message).toMatch(/Limite de 50 produits/);
      expect(prisma.product.create).toHaveBeenCalledTimes(1);
    });

    it('ne consomme pas de quota quand les lignes mettent à jour des produits existants', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.product.findFirst.mockResolvedValue({ id: 'p-existant', tenantId: 'tenant-1' });
      prisma.product.update.mockResolvedValue({ id: 'p-existant', name: 'Produit A' });
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.product.count.mockResolvedValue(50); // quota déjà plein

      const file = buildXlsxFile([{ Nom: 'Produit A', Prix: 1000, Coût: 800, Stock: 1 }]);

      const result = await service.importCatalog('tenant-1', 'admin-1', 'ADMIN', file, 's1');

      expect(result.updatedCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('laisse passer un import volumineux sur un plan sans limite de produits', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p1', name: 'Produit' });
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'BUSINESS' });
      prisma.product.count.mockResolvedValue(10_000);

      const file = buildXlsxFile([
        { Nom: 'Produit A', Prix: 1000, Coût: 800, Stock: 1 },
        { Nom: 'Produit B', Prix: 1000, Coût: 800, Stock: 1 },
      ]);

      const result = await service.importCatalog('tenant-1', 'admin-1', 'ADMIN', file, 's1');

      expect(result.createdCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });
  });
});
