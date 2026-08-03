import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveActiveStoreId } from './stores-helper';

function buildPrismaMock() {
  return {
    store: { findFirst: vi.fn(), findMany: vi.fn() },
    userStore: { findUnique: vi.fn(), findMany: vi.fn() },
  };
}

describe('resolveActiveStoreId', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it('utilise la boutique demandée si elle appartient au tenant et que le CAISSIER y a accès', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
    prisma.userStore.findUnique.mockResolvedValue({ userId: 'u1', storeId: 's1' });

    const result = await resolveActiveStoreId(prisma as any, 'tenant-1', 'u1', 'CAISSIER', 's1');

    expect(result).toBe('s1');
  });

  it("refuse la boutique demandée si le non-ADMIN n'y a pas accès", async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });
    prisma.userStore.findUnique.mockResolvedValue(null);

    await expect(
      resolveActiveStoreId(prisma as any, 'tenant-1', 'u1', 'CAISSIER', 's1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse une boutique demandée qui n'appartient pas au tenant", async () => {
    prisma.store.findFirst.mockResolvedValue(null);

    await expect(
      resolveActiveStoreId(prisma as any, 'tenant-1', 'u1', 'ADMIN', 'autre-tenant-store'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un ADMIN a accès à la boutique demandée sans entrée UserStore', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 's1', tenantId: 'tenant-1' });

    const result = await resolveActiveStoreId(prisma as any, 'tenant-1', 'admin-1', 'ADMIN', 's1');

    expect(result).toBe('s1');
    expect(prisma.userStore.findUnique).not.toHaveBeenCalled();
  });

  it('auto-sélectionne l’unique boutique assignée à un non-ADMIN sans storeId fourni', async () => {
    prisma.userStore.findMany.mockResolvedValue([{ userId: 'u1', storeId: 's1' }]);

    const result = await resolveActiveStoreId(prisma as any, 'tenant-1', 'u1', 'CAISSIER', undefined);

    expect(result).toBe('s1');
  });

  it("refuse si le non-ADMIN n'est assigné à aucune boutique", async () => {
    prisma.userStore.findMany.mockResolvedValue([]);

    await expect(
      resolveActiveStoreId(prisma as any, 'tenant-1', 'u1', 'CAISSIER', undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige une boutique explicite si le non-ADMIN en a plusieurs', async () => {
    prisma.userStore.findMany.mockResolvedValue([
      { userId: 'u1', storeId: 's1' },
      { userId: 'u1', storeId: 's2' },
    ]);

    await expect(
      resolveActiveStoreId(prisma as any, 'tenant-1', 'u1', 'CAISSIER', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retourne null pour un ADMIN sans storeId quand allowAllStores est activé (vue globale)', async () => {
    prisma.store.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

    const result = await resolveActiveStoreId(prisma as any, 'tenant-1', 'admin-1', 'ADMIN', undefined, true);

    expect(result).toBeNull();
  });

  it("auto-sélectionne l'unique boutique du tenant pour un ADMIN sans storeId et allowAllStores désactivé", async () => {
    prisma.store.findMany.mockResolvedValue([{ id: 's1' }]);

    const result = await resolveActiveStoreId(prisma as any, 'tenant-1', 'admin-1', 'ADMIN', undefined, false);

    expect(result).toBe('s1');
  });
});
