import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

function buildPrismaMock() {
  return {
    apiKey: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
}

describe('ApiKeysService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ApiKeysService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ApiKeysService(prisma as any);
  });

  describe('create', () => {
    it('génère une clé, ne stocke que son hash, et retourne la clé en clair une seule fois', async () => {
      prisma.apiKey.create.mockResolvedValue({ id: 'key-1', name: 'Intégration compta', createdAt: new Date() });

      const result = await service.create('tenant-1', { name: 'Intégration compta' } as any);

      const createCall = prisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe('tenant-1');
      expect(createCall.data.keyHash).toBeTruthy();
      expect(createCall.data).not.toHaveProperty('plainKey');

      expect(result.plainKey).toMatch(/^bsk_/);
      expect(result.id).toBe('key-1');
    });

    it('génère une clé en clair différente à chaque appel', async () => {
      prisma.apiKey.create.mockResolvedValue({ id: 'key-1' });

      const result1 = await service.create('tenant-1', { name: 'A' } as any);
      const result2 = await service.create('tenant-1', { name: 'B' } as any);

      expect(result1.plainKey).not.toBe(result2.plainKey);
    });
  });

  describe('revoke', () => {
    it('révoque une clé existante (fixe revokedAt)', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', tenantId: 'tenant-1' });
      prisma.apiKey.update.mockResolvedValue({ id: 'key-1', revokedAt: new Date() });

      const result = await service.revoke('tenant-1', 'key-1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'key-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(result.revokedAt).toBeTruthy();
    });

    it("lève une erreur si la clé n'existe pas dans ce tenant", async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('tenant-1', 'inconnue')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
