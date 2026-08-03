import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { TwoFactorService } from './two-factor.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(async (pw: string, hash: string) => hash === `hashed-${pw}`),
}));

function buildPrismaMock() {
  return {
    user: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
  };
}

describe('TwoFactorService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TwoFactorService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TwoFactorService(prisma as any);
  });

  describe('setup', () => {
    it('génère un secret, le stocke et retourne un QR code', async () => {
      prisma.user.update.mockResolvedValue({});

      const result = await service.setup('user-1', 'admin@x.ml');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(result.secret).toBeTruthy();
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('verify', () => {
    it('active le 2FA si le code correspond au secret stocké', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorSecret: secret });
      prisma.user.update.mockResolvedValue({});

      const result = await service.verify('user-1', validCode);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twoFactorEnabled: true } }),
      );
      expect(result.success).toBe(true);
    });

    it('rejette un code invalide', async () => {
      const secret = authenticator.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorSecret: secret });

      await expect(service.verify('user-1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("refuse si aucun secret n'a été généré au préalable", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', twoFactorSecret: null });

      await expect(service.verify('user-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('disable', () => {
    it('désactive le 2FA si le mot de passe est correct', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: 'hashed-secret123' });
      prisma.user.update.mockResolvedValue({});

      const result = await service.disable('user-1', 'secret123');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twoFactorEnabled: false, twoFactorSecret: null } }),
      );
      expect(result.success).toBe(true);
    });

    it('rejette si le mot de passe est incorrect', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash: 'hashed-secret123' });

      await expect(service.disable('user-1', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyLoginCode', () => {
    it('retourne true pour un code TOTP valide', () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);

      expect(service.verifyLoginCode(secret, validCode)).toBe(true);
    });

    it('retourne false pour un code invalide', () => {
      const secret = authenticator.generateSecret();

      expect(service.verifyLoginCode(secret, '000000')).toBe(false);
    });
  });
});
