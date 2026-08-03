import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async (pw: string) => `hashed-${pw}`),
  compare: vi.fn(async (pw: string, hash: string) => hash === `hashed-${pw}`),
}));

function buildPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    tenant: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    userStore: { create: vi.fn(), findMany: vi.fn() },
    store: { findMany: vi.fn() },
  };
}

function buildJwtMock() {
  return { sign: vi.fn(() => 'signed.jwt.token') };
}

function buildTwoFactorMock() {
  return { verifyLoginCode: vi.fn() };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwt: ReturnType<typeof buildJwtMock>;
  let twoFactor: ReturnType<typeof buildTwoFactorMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    jwt = buildJwtMock();
    twoFactor = buildTwoFactorMock();
    service = new AuthService(prisma as any, jwt as any, twoFactor as any);
  });

  describe('register', () => {
    it('crée un tenant, un admin et une boutique par défaut, retourne un token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        name: 'Ma Boutique',
        tvaEnabled: false,
        tvaRate: 0,
        users: [{ id: 'user-1', email: 'admin@x.ml', role: 'ADMIN', name: 'Admin', theme: 'light' }],
        stores: [{ id: 'store-1', name: 'Ma Boutique' }],
      });

      const result = await service.register({
        shopName: 'Ma Boutique',
        adminName: 'Admin',
        email: 'admin@x.ml',
        password: 'password123',
      });

      expect(prisma.tenant.create).toHaveBeenCalled();
      expect(prisma.userStore.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', storeId: 'store-1' },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.tenantId).toBe('tenant-1');
      expect(result.defaultStoreId).toBe('store-1');
      expect(result.stores).toEqual([{ id: 'store-1', name: 'Ma Boutique' }]);
    });

    it("rejette si l'e-mail existe déjà", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          shopName: 'X',
          adminName: 'Y',
          email: 'taken@x.ml',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('retourne un token et défini defaultStoreId quand une seule boutique est accessible', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'CAISSIER',
        active: true,
        tenantId: 'tenant-1',
        name: 'Caissier',
        theme: 'light',
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        id: 'tenant-1',
        name: 'Ma Boutique',
        tvaEnabled: false,
        tvaRate: 0,
      });
      prisma.userStore.findMany.mockResolvedValue([
        { userId: 'user-1', storeId: 'store-1', store: { id: 'store-1', name: 'Bamako' } },
      ]);

      const result = (await service.login({ email: 'admin@x.ml', password: 'password123' })) as any;

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.defaultStoreId).toBe('store-1');
    });

    it('ne définit pas defaultStoreId quand plusieurs boutiques sont accessibles (sélecteur requis)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'manager@x.ml',
        passwordHash: 'hashed-password123',
        role: 'MANAGER',
        active: true,
        tenantId: 'tenant-1',
        name: 'Manager',
        theme: 'light',
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        id: 'tenant-1',
        name: 'Ma Boutique',
        tvaEnabled: false,
        tvaRate: 0,
      });
      prisma.userStore.findMany.mockResolvedValue([
        { userId: 'user-1', storeId: 'store-1', store: { id: 'store-1', name: 'Bamako' } },
        { userId: 'user-1', storeId: 'store-2', store: { id: 'store-2', name: 'Sikasso' } },
      ]);

      const result = (await service.login({ email: 'manager@x.ml', password: 'password123' })) as any;

      expect(result.defaultStoreId).toBeNull();
      expect(result.stores).toHaveLength(2);
    });

    it('un ADMIN a accès à toutes les boutiques du tenant sans entrée UserStore', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'ADMIN',
        active: true,
        tenantId: 'tenant-1',
        name: 'Admin',
        theme: 'light',
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        id: 'tenant-1',
        name: 'Ma Boutique',
        tvaEnabled: false,
        tvaRate: 0,
      });
      prisma.store.findMany.mockResolvedValue([
        { id: 'store-1', name: 'Bamako' },
        { id: 'store-2', name: 'Sikasso' },
      ]);

      const result = (await service.login({ email: 'admin@x.ml', password: 'password123' })) as any;

      expect(prisma.userStore.findMany).not.toHaveBeenCalled();
      expect(result.stores).toHaveLength(2);
    });

    it("rejette si l'utilisateur n'existe pas", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'x@x.ml', password: 'x' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejette si le mot de passe est incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'ADMIN',
        active: true,
        tenantId: 'tenant-1',
        name: 'Admin',
      });

      await expect(
        service.login({ email: 'admin@x.ml', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejette si le compte est désactivé', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'CAISSIER',
        active: false,
        tenantId: 'tenant-1',
        name: 'Caissier',
      });

      await expect(
        service.login({ email: 'admin@x.ml', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('retourne requiresTwoFactor sans token si le mot de passe est correct mais le 2FA activé et aucun code fourni', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'ADMIN',
        active: true,
        tenantId: 'tenant-1',
        name: 'Admin',
        theme: 'light',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET123',
      });

      const result = await service.login({ email: 'admin@x.ml', password: 'password123' });

      expect(result).toEqual({ requiresTwoFactor: true });
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('délivre un token si le code 2FA fourni est valide', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'ADMIN',
        active: true,
        tenantId: 'tenant-1',
        name: 'Admin',
        theme: 'light',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET123',
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        id: 'tenant-1',
        name: 'Ma Boutique',
        tvaEnabled: false,
        tvaRate: 0,
      });
      prisma.store.findMany.mockResolvedValue([{ id: 'store-1', name: 'Bamako' }]);
      twoFactor.verifyLoginCode.mockReturnValue(true);

      const result = (await service.login({
        email: 'admin@x.ml',
        password: 'password123',
        code: '123456',
      })) as any;

      expect(twoFactor.verifyLoginCode).toHaveBeenCalledWith('SECRET123', '123456');
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejette un code 2FA invalide', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@x.ml',
        passwordHash: 'hashed-password123',
        role: 'ADMIN',
        active: true,
        tenantId: 'tenant-1',
        name: 'Admin',
        theme: 'light',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET123',
      });
      twoFactor.verifyLoginCode.mockReturnValue(false);

      await expect(
        service.login({ email: 'admin@x.ml', password: 'password123', code: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
