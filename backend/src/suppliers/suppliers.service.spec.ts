import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

function buildTxMock() {
  return {
    supplier: { findFirst: vi.fn(), update: vi.fn() },
    supplierPayment: { create: vi.fn() },
  };
}

function buildPrismaMock(tx: ReturnType<typeof buildTxMock>) {
  return {
    $transaction: vi.fn((cbOrArray: any) => {
      if (typeof cbOrArray === 'function') return cbOrArray(tx);
      return Promise.all(cbOrArray);
    }),
    supplier: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('SuppliersService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: SuppliersService;

  beforeEach(() => {
    tx = buildTxMock();
    prisma = buildPrismaMock(tx);
    service = new SuppliersService(prisma as any);
  });

  describe('findAll', () => {
    it('liste les fournisseurs du tenant avec pagination', async () => {
      prisma.supplier.findMany.mockResolvedValue([{ id: 's1', name: 'Grossiste Bamako' }]);
      prisma.supplier.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1', { page: 1, pageSize: 20 } as any);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('crée un fournisseur', async () => {
      prisma.supplier.create.mockResolvedValue({ id: 's1', name: 'Grossiste Bamako' });

      const result = await service.create('tenant-1', { name: 'Grossiste Bamako' } as any);

      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
      );
      expect(result.name).toBe('Grossiste Bamako');
    });
  });

  describe('addPayment', () => {
    it('enregistre un règlement et diminue le solde', async () => {
      tx.supplier.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1', balance: 5000 });
      tx.supplierPayment.create.mockResolvedValue({ id: 'pay-1', amount: 2000 });

      const result = await service.addPayment('tenant-1', 'user-1', 's1', {
        amount: 2000,
        method: 'CASH',
      } as any);

      expect(tx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's1' }, data: { balance: { decrement: 2000 } } }),
      );
      expect(result.amount).toBe(2000);
    });

    it('refuse un règlement supérieur à la dette actuelle', async () => {
      tx.supplier.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1', balance: 1000 });

      await expect(
        service.addPayment('tenant-1', 'user-1', 's1', { amount: 5000, method: 'CASH' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.supplierPayment.create).not.toHaveBeenCalled();
    });

    it("lève une erreur si le fournisseur n'appartient pas au tenant", async () => {
      tx.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.addPayment('tenant-1', 'user-1', 'inconnu', { amount: 100, method: 'CASH' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it("lève une erreur si le fournisseur n'existe pas dans ce tenant", async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.update('tenant-1', 'inconnu', { name: 'X' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
