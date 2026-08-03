import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

function buildTxMock() {
  return {
    customer: { findFirst: vi.fn(), update: vi.fn() },
    customerPayment: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
}

function buildPrismaMock(tx: ReturnType<typeof buildTxMock>) {
  return {
    $transaction: vi.fn((cbOrArray: any) => {
      if (typeof cbOrArray === 'function') return cbOrArray(tx);
      return Promise.all(cbOrArray);
    }),
    customer: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
}

describe('CustomersService', () => {
  let tx: ReturnType<typeof buildTxMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: CustomersService;

  beforeEach(() => {
    tx = buildTxMock();
    prisma = buildPrismaMock(tx);
    service = new CustomersService(prisma as any);
  });

  describe('findAll', () => {
    it('liste les clients du tenant avec pagination', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'Fatou' }]);
      prisma.customer.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1', { page: 1, pageSize: 20 } as any);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('crée un client avec un plafond de crédit', async () => {
      prisma.customer.create.mockResolvedValue({ id: 'c1', name: 'Fatou', creditLimit: 20000 });

      const result = await service.create('tenant-1', { name: 'Fatou', creditLimit: 20000 } as any);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', creditLimit: 20000 }) }),
      );
      expect(result.name).toBe('Fatou');
    });
  });

  describe('addPayment', () => {
    it('enregistre un règlement et diminue le solde du client', async () => {
      tx.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'Fatou', tenantId: 'tenant-1', creditBalance: 5000 });
      tx.customerPayment.create.mockResolvedValue({ id: 'pay-1', amount: 2000 });

      const result = await service.addPayment('tenant-1', 'user-1', 'c1', {
        amount: 2000,
        method: 'CASH',
      } as any);

      expect(tx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' }, data: { creditBalance: { decrement: 2000 } } }),
      );
      expect(result.amount).toBe(2000);
    });

    it('crée une notification PAYMENT_RECEIVED visible par tous les admins', async () => {
      tx.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'Fatou', tenantId: 'tenant-1', creditBalance: 5000 });
      tx.customerPayment.create.mockResolvedValue({ id: 'pay-1', amount: 2000 });

      await service.addPayment('tenant-1', 'user-1', 'c1', { amount: 2000, method: 'CASH' } as any);

      expect(tx.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1', type: 'PAYMENT_RECEIVED', userId: null }),
        }),
      );
    });

    it('refuse un règlement supérieur à la dette actuelle', async () => {
      tx.customer.findFirst.mockResolvedValue({ id: 'c1', tenantId: 'tenant-1', creditBalance: 1000 });

      await expect(
        service.addPayment('tenant-1', 'user-1', 'c1', { amount: 5000, method: 'CASH' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.customerPayment.create).not.toHaveBeenCalled();
    });

    it("lève une erreur si le client n'appartient pas au tenant", async () => {
      tx.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.addPayment('tenant-1', 'user-1', 'inconnu', { amount: 100, method: 'CASH' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it("lève une erreur si le client n'existe pas dans ce tenant", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'inconnu', { name: 'X' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
