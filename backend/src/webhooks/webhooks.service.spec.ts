import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

function buildPrismaMock() {
  return {
    webhook: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  };
}

describe('WebhooksService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: WebhooksService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new WebhooksService(prisma as any);
  });

  describe('create', () => {
    it('crée un webhook avec un secret généré et le retourne une seule fois', async () => {
      prisma.webhook.create.mockResolvedValue({ id: 'wh-1', url: 'https://example.com/hook', events: ['sale.created'] });

      const result = await service.create('tenant-1', {
        url: 'https://example.com/hook',
        events: ['sale.created'],
      } as any);

      const createCall = prisma.webhook.create.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe('tenant-1');
      expect(createCall.data.secret).toBeTruthy();
      expect(result.secret).toBe(createCall.data.secret);
    });
  });

  describe('remove', () => {
    it('supprime un webhook existant', async () => {
      prisma.webhook.findFirst.mockResolvedValue({ id: 'wh-1', tenantId: 'tenant-1' });
      prisma.webhook.delete.mockResolvedValue({});

      const result = await service.remove('tenant-1', 'wh-1');

      expect(prisma.webhook.delete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
      expect(result.success).toBe(true);
    });

    it("lève une erreur si le webhook n'existe pas dans ce tenant", async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(service.remove('tenant-1', 'inconnu')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
