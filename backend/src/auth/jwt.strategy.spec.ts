import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

const PAYLOAD: JwtPayload = {
  sub: 'user-1',
  email: 'caissier@boutique-demo.ml',
  role: 'CAISSIER',
  tenantId: 'tenant-1',
};

function buildStrategy(findUnique: ReturnType<typeof vi.fn>) {
  const config = { getOrThrow: () => 'un-secret-de-test-suffisamment-long' } as unknown as ConfigService;
  const prisma = { user: { findUnique } } as any;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy', () => {
  let findUnique: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findUnique = vi.fn();
  });

  it('accepte un utilisateur actif', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'caissier@boutique-demo.ml',
      role: 'CAISSIER',
      active: true,
      tenantId: 'tenant-1',
    });

    await expect(buildStrategy(findUnique).validate(PAYLOAD)).resolves.toEqual({
      userId: 'user-1',
      email: 'caissier@boutique-demo.ml',
      role: 'CAISSIER',
      tenantId: 'tenant-1',
    });
  });

  it('refuse un utilisateur désactivé, même avec un token encore valide', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'caissier@boutique-demo.ml',
      role: 'CAISSIER',
      active: false,
      tenantId: 'tenant-1',
    });

    await expect(buildStrategy(findUnique).validate(PAYLOAD)).rejects.toThrow(UnauthorizedException);
  });

  it('refuse un utilisateur supprimé entre-temps', async () => {
    findUnique.mockResolvedValue(null);

    await expect(buildStrategy(findUnique).validate(PAYLOAD)).rejects.toThrow(UnauthorizedException);
  });

  it('retient le rôle de la base et non celui du token', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'caissier@boutique-demo.ml',
      role: 'CAISSIER',
      active: true,
      tenantId: 'tenant-1',
    });

    // Un token forgé — ou simplement émis avant une rétrogradation — annonce ADMIN.
    const result = await buildStrategy(findUnique).validate({ ...PAYLOAD, role: 'ADMIN' });

    expect(result.role).toBe('CAISSIER');
  });

  it('retient le tenant de la base et non celui du token', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'caissier@boutique-demo.ml',
      role: 'CAISSIER',
      active: true,
      tenantId: 'tenant-1',
    });

    const result = await buildStrategy(findUnique).validate({ ...PAYLOAD, tenantId: 'tenant-victime' });

    expect(result.tenantId).toBe('tenant-1');
  });

  it("relit l'utilisateur par sa clé primaire à chaque requête", async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'caissier@boutique-demo.ml',
      role: 'CAISSIER',
      active: true,
      tenantId: 'tenant-1',
    });

    await buildStrategy(findUnique).validate(PAYLOAD);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });
});
