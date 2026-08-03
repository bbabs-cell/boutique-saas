import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

function buildPrismaMock() {
  return {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe('CategoriesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new CategoriesService(prisma as any);
  });

  it('liste les catégories du tenant', async () => {
    prisma.category.findMany.mockResolvedValue([{ id: 'c1', name: 'Boissons' }]);
    const result = await service.findAll('tenant-1');
    expect(result).toHaveLength(1);
  });

  it('crée une catégorie', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'c1', name: 'Boissons' });

    const result = await service.create('tenant-1', { name: 'Boissons' });
    expect(result.name).toBe('Boissons');
  });

  it('rejette une catégorie en double pour le même tenant', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', name: 'Boissons' });

    await expect(service.create('tenant-1', { name: 'Boissons' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
