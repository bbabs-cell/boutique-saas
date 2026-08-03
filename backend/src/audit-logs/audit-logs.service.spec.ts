import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogsService } from './audit-logs.service';

function buildPrismaMock() {
  return {
    $transaction: vi.fn((arr: any[]) => Promise.all(arr)),
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  };
}

describe('AuditLogsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AuditLogsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AuditLogsService(prisma as any);
  });

  it('liste les entrées du journal avec pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1', action: 'products.create' }]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', { page: 1, pageSize: 20 } as any);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(result.total).toBe(1);
  });

  it('filtre par utilisateur, action et type d’entité', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await service.findAll('tenant-1', {
      userId: 'user-1',
      action: 'products.update',
      entityType: 'products',
      page: 1,
      pageSize: 20,
    } as any);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          action: 'products.update',
          entityType: 'products',
        }),
      }),
    );
  });
});
