import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(role: string | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('autorise tout utilisateur authentifié si aucun rôle requis (métadonnée absente)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(buildContext('CAISSIER'))).toBe(true);
  });

  it('autorise un rôle présent dans la liste requise', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'MANAGER']);
    expect(guard.canActivate(buildContext('MANAGER'))).toBe(true);
  });

  it('refuse un rôle absent de la liste requise (ex : CAISSIER sur une route ADMIN/MANAGER)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'MANAGER']);
    expect(() => guard.canActivate(buildContext('CAISSIER'))).toThrow(ForbiddenException);
  });

  it('refuse un MAGASINIER sur une route réservée à la vente (ADMIN/MANAGER/CAISSIER)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'MANAGER', 'CAISSIER']);
    expect(() => guard.canActivate(buildContext('MAGASINIER'))).toThrow(ForbiddenException);
  });

  it('refuse un CAISSIER sur une route réservée au stock (ADMIN/MANAGER/MAGASINIER)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'MANAGER', 'MAGASINIER']);
    expect(() => guard.canActivate(buildContext('CAISSIER'))).toThrow(ForbiddenException);
  });

  it('refuse un MANAGER sur une route réservée à ADMIN (ex : comptabilité, paramètres)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(buildContext('MANAGER'))).toThrow(ForbiddenException);
  });

  it("refuse l'accès si aucun utilisateur n'est attaché à la requête", () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
