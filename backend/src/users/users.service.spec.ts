import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async (pw: string) => `hashed-${pw}`),
}));

function buildPrismaMock() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscription: { findUnique: vi.fn(), create: vi.fn() },
    // Boutique unique du tenant par défaut : le nouvel employé y est affecté automatiquement.
    store: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
  };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new UsersService(prisma as any);
  });

  it('liste les employés du tenant', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    const result = await service.findAll('tenant-1');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(result).toEqual([{ id: 'u1' }]);
  });

  it('un ADMIN peut créer un caissier', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', role: 'CAISSIER' });

    const result = await service.create('tenant-1', 'ADMIN', {
      name: 'Caissier 1',
      email: 'caissier@x.ml',
      password: 'password123',
      role: 'CAISSIER',
    } as any);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'CAISSIER', tenantId: 'tenant-1' }),
      }),
    );
    expect(result.role).toBe('CAISSIER');
  });

  it('un ADMIN peut créer un autre ADMIN', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u3', role: 'ADMIN' });

    const result = await service.create('tenant-1', 'ADMIN', {
      name: 'Second Admin',
      email: 'admin2@x.ml',
      password: 'password123',
      role: 'ADMIN',
    } as any);

    expect(result.role).toBe('ADMIN');
  });

  it('un MANAGER peut créer un magasinier (plan avec rôles fins)', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ plan: 'STARTER' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u4', role: 'MAGASINIER' });

    const result = await service.create('tenant-1', 'MANAGER', {
      name: 'Magasinier 1',
      email: 'magasinier@x.ml',
      password: 'password123',
      role: 'MAGASINIER',
    } as any);

    expect(result.role).toBe('MAGASINIER');
  });

  it('refuse de créer un MANAGER/MAGASINIER si le plan ne permet pas les rôles fins (Gratuit)', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });

    await expect(
      service.create('tenant-1', 'ADMIN', {
        name: 'Magasinier 1',
        email: 'magasinier@x.ml',
        password: 'password123',
        role: 'MAGASINIER',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('un MANAGER ne peut pas créer un ADMIN', async () => {
    await expect(
      service.create('tenant-1', 'MANAGER', {
        name: 'Tentative',
        email: 'x@x.ml',
        password: 'password123',
        role: 'ADMIN',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejette la création si l'e-mail existe déjà", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create('tenant-1', 'ADMIN', {
        name: 'X',
        email: 'taken@x.ml',
        password: 'password123',
        role: 'CAISSIER',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("active/désactive un employé du même tenant", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', tenantId: 'tenant-1' });
    prisma.user.update.mockResolvedValue({ id: 'u2', active: false });

    const result = await service.setActive('tenant-1', 'u2', { active: false });

    expect(result.active).toBe(false);
  });

  it("rejette si l'employé n'appartient pas au tenant", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.setActive('tenant-1', 'unknown', { active: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe("affectation aux boutiques à la création", () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u2', role: 'CAISSIER' });
    });

    const caissier = {
      name: 'Caissier 1',
      email: 'caissier@x.ml',
      password: 'password123',
      role: 'CAISSIER',
    };

    it("affecte l'employé à la boutique transmise — sans quoi son compte ne peut rien faire", async () => {
      prisma.store.findMany.mockResolvedValue([{ id: 's2' }]);

      await service.create('tenant-1', 'ADMIN', { ...caissier, storeId: 's2' } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userStores: { create: [{ storeId: 's2' }] },
          }),
        }),
      );
    });

    it('accepte plusieurs boutiques', async () => {
      prisma.store.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      await service.create('tenant-1', 'ADMIN', { ...caissier, storeIds: ['s1', 's2'] } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userStores: { create: [{ storeId: 's1' }, { storeId: 's2' }] },
          }),
        }),
      );
    });

    it("retombe sur l'unique boutique du tenant quand aucune n'est précisée", async () => {
      prisma.store.findMany.mockResolvedValue([{ id: 's1' }]);

      await service.create('tenant-1', 'ADMIN', caissier as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userStores: { create: [{ storeId: 's1' }] } }),
        }),
      );
    });

    it("refuse de créer un compte inutilisable quand le tenant a plusieurs boutiques et qu'aucune n'est précisée", async () => {
      prisma.store.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      await expect(service.create('tenant-1', 'ADMIN', caissier as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("refuse une boutique d'une autre organisation", async () => {
      prisma.store.findMany.mockResolvedValue([]); // la boutique demandée n'est pas dans ce tenant

      await expect(
        service.create('tenant-1', 'ADMIN', { ...caissier, storeId: 's-autre-tenant' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("n'exige aucune affectation pour un ADMIN, qui voit déjà toutes les boutiques", async () => {
      prisma.store.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prisma.user.create.mockResolvedValue({ id: 'u3', role: 'ADMIN' });

      await service.create('tenant-1', 'ADMIN', { ...caissier, role: 'ADMIN' } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userStores: { create: [] } }),
        }),
      );
    });
  });
});
