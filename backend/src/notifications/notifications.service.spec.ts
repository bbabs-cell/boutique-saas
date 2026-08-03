import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

function buildPrismaMock() {
  return {
    $transaction: vi.fn((arr: any[]) => Promise.all(arr)),
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

describe('NotificationsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new NotificationsService(prisma as any);
  });

  describe('findAll', () => {
    it('liste les notifications visibles (globales + celles de l’utilisateur) avec le compte de non-lues', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1', read: false }]);
      prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      const result = await service.findAll('tenant-1', 'user-1', { page: 1, pageSize: 20 } as any);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1', OR: [{ userId: null }, { userId: 'user-1' }] }),
        }),
      );
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
    });

    it('filtre par statut lu/non lu', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findAll('tenant-1', 'user-1', { read: false, page: 1, pageSize: 20 } as any);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ read: false }) }),
      );
    });
  });

  describe('markRead', () => {
    it('marque une notification comme lue', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1', tenantId: 'tenant-1' });
      prisma.notification.update.mockResolvedValue({ id: 'n1', read: true });

      const result = await service.markRead('tenant-1', 'user-1', 'n1');

      expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 'n1' }, data: { read: true } });
      expect(result.read).toBe(true);
    });

    it("lève une erreur si la notification n'est pas visible pour ce tenant/utilisateur", async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markRead('tenant-1', 'user-1', 'inconnue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('markAllRead', () => {
    it('marque toutes les notifications non lues comme lues', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllRead('tenant-1', 'user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { read: true } }),
      );
      expect(result.updated).toBe(3);
    });
  });
});
