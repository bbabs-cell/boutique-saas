import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

function buildPrismaMock() {
  return {
    $transaction: vi.fn((arr: any[]) => Promise.all(arr)),
    expense: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('ExpensesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ExpensesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ExpensesService(prisma as any);
  });

  describe('findAll', () => {
    it('liste les dépenses du tenant avec pagination', async () => {
      prisma.expense.findMany.mockResolvedValue([{ id: 'e1', label: 'Loyer' }]);
      prisma.expense.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1', { page: 1, pageSize: 20 } as any);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('filtre par catégorie', async () => {
      prisma.expense.findMany.mockResolvedValue([]);
      prisma.expense.count.mockResolvedValue(0);

      await service.findAll('tenant-1', { category: 'loyer', page: 1, pageSize: 20 } as any);

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: 'loyer' }) }),
      );
    });
  });

  describe('create', () => {
    it('crée une dépense rattachée au tenant et à l’utilisateur', async () => {
      prisma.expense.create.mockResolvedValue({ id: 'e1', label: 'Transport', amount: 5000 });

      const result = await service.create('tenant-1', 'user-1', {
        label: 'Transport',
        amount: 5000,
        category: 'transport',
      } as any);

      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1', amount: 5000 }),
        }),
      );
      expect(result.label).toBe('Transport');
    });
  });

  describe('update', () => {
    it("lève une erreur si la dépense n'existe pas dans ce tenant", async () => {
      prisma.expense.findFirst.mockResolvedValue(null);

      await expect(service.update('tenant-1', 'inconnue', { label: 'X' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('supprime une dépense existante', async () => {
      prisma.expense.findFirst.mockResolvedValue({ id: 'e1', tenantId: 'tenant-1' });
      prisma.expense.delete.mockResolvedValue({});

      const result = await service.remove('tenant-1', 'e1');

      expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
      expect(result.success).toBe(true);
    });

    it("lève une erreur si la dépense n'existe pas dans ce tenant", async () => {
      prisma.expense.findFirst.mockResolvedValue(null);

      await expect(service.remove('tenant-1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
