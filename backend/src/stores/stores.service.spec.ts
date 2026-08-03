import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StoresService } from './stores.service';

function buildPrismaMock() {
  return {
    store: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn() },
    userStore: { upsert: vi.fn(), deleteMany: vi.fn() },
  };
}

describe('StoresService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: StoresService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new StoresService(prisma as any);
  });

  describe('create', () => {
    it('crée une boutique rattachée au tenant', async () => {
      prisma.store.create.mockResolvedValue({ id: 's1', name: 'Boutique Bamako' });

      const result = await service.create('tenant-1', { name: 'Boutique Bamako' } as any);

      expect(prisma.store.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
      );
      expect(result.name).toBe('Boutique Bamako');
    });
  });

  describe('assignUser', () => {
    it('assigne un employé du même tenant à la boutique', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', tenantId: 'tenant-1' });
      prisma.userStore.upsert.mockResolvedValue({ userId: 'u1', storeId: 's1' });

      const result = await service.assignUser('tenant-1', 's1', { userId: 'u1' } as any);

      expect(prisma.userStore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: { userId: 'u1', storeId: 's1' } }),
      );
      expect(result.storeId).toBe('s1');
    });

    it("refuse d'assigner un employé d'un autre tenant", async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.assignUser('tenant-1', 's1', { userId: 'autre-tenant' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("lève une erreur si la boutique n'existe pas dans ce tenant", async () => {
      prisma.store.findFirst.mockResolvedValue(null);

      await expect(service.assignUser('tenant-1', 'inconnue', { userId: 'u1' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it("lève une erreur si la boutique n'existe pas dans ce tenant", async () => {
      prisma.store.findFirst.mockResolvedValue(null);

      await expect(service.update('tenant-1', 'inconnue', { name: 'X' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
