import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

function buildPrismaMock() {
  return {
    tenant: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  };
}

function buildStorageMock() {
  return { uploadLogo: vi.fn() };
}

describe('SettingsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let storage: ReturnType<typeof buildStorageMock>;
  let service: SettingsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    storage = buildStorageMock();
    service = new SettingsService(prisma as any, storage as any);
  });

  describe('getSettings', () => {
    it('retourne les paramètres du tenant', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', name: 'Boutique Demo' });

      const result = await service.getSettings('tenant-1');

      expect(result.name).toBe('Boutique Demo');
    });
  });

  describe('updateSettings', () => {
    it('met à jour uniquement les champs fournis', async () => {
      prisma.tenant.update.mockResolvedValue({ id: 'tenant-1', name: 'Nouvelle Boutique' });

      await service.updateSettings('tenant-1', { name: 'Nouvelle Boutique' } as any);

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: { name: 'Nouvelle Boutique' },
        }),
      );
    });
  });

  describe('uploadLogo', () => {
    it('refuse un fichier manquant', async () => {
      await expect(service.uploadLogo('tenant-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un type de fichier non supporté', async () => {
      await expect(
        service.uploadLogo('tenant-1', {
          mimetype: 'application/pdf',
          size: 1000,
          buffer: Buffer.from(''),
          originalname: 'logo.pdf',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un fichier trop volumineux', async () => {
      await expect(
        service.uploadLogo('tenant-1', {
          mimetype: 'image/png',
          size: 5 * 1024 * 1024,
          buffer: Buffer.from(''),
          originalname: 'logo.png',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('téléverse le logo et met à jour le tenant', async () => {
      storage.uploadLogo.mockResolvedValue('https://storage.example/logos/tenant-1/logo.png');
      prisma.tenant.update.mockResolvedValue({});

      const result = await service.uploadLogo('tenant-1', {
        mimetype: 'image/png',
        size: 1000,
        buffer: Buffer.from(''),
        originalname: 'logo.png',
      } as any);

      expect(result.logoUrl).toBe('https://storage.example/logos/tenant-1/logo.png');
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: { logoUrl: 'https://storage.example/logos/tenant-1/logo.png' },
        }),
      );
    });
  });
});
