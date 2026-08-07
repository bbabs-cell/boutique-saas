import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { hashApiKey } from '../api-key.util';

function buildPrismaMock() {
  return {
    apiKey: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    // L'API publique est réservée aux plans qui l'incluent : par défaut, un plan qui y donne
    // droit. Les tests du contrôle de plan redéfinissent cette valeur.
    subscription: { findUnique: vi.fn().mockResolvedValue({ plan: 'PREMIUM' }), create: vi.fn() },
  };
}

function buildContext(headers: Record<string, string>) {
  const req: any = { headers };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    _req: req,
  } as any;
}

/** Simule le contexte que GqlExecutionContext.create() reçoit pour un resolver GraphQL :
 *  la requête HTTP sous-jacente est le 3e argument (root, args, context, info). */
function buildGraphqlContext(headers: Record<string, string>) {
  const req: any = { headers };
  const gqlContext = { req };
  return {
    getType: () => 'graphql',
    getArgs: () => [undefined, undefined, gqlContext, undefined],
    getArgByIndex: (index: number) => (index === 2 ? gqlContext : undefined),
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    _req: req,
  } as any;
}

describe('ApiKeyGuard', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    prisma = buildPrismaMock();
    guard = new ApiKeyGuard(prisma as any);
  });

  it('autorise une clé valide et attache le tenantId à la requête', async () => {
    const plainKey = 'bsk_test123';
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-1',
      keyHash: hashApiKey(plainKey),
      revokedAt: null,
    });
    const context = buildContext({ 'x-api-key': plainKey });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context._req.tenantId).toBe('tenant-1');
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'key-1' } }),
    );
  });

  it('refuse une requête sans clé API', async () => {
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("refuse une clé qui n'existe pas", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    const context = buildContext({ 'x-api-key': 'bsk_inconnue' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse une clé révoquée', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-1',
      revokedAt: new Date(),
    });
    const context = buildContext({ 'x-api-key': 'bsk_revoked' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authentifie aussi une requête GraphQL (même logique que REST, contexte différent)', async () => {
    const plainKey = 'bsk_graphql123';
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-1',
      keyHash: hashApiKey(plainKey),
      revokedAt: null,
    });
    const context = buildGraphqlContext({ 'x-api-key': plainKey });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context._req.tenantId).toBe('tenant-1');
  });

  describe("contrôle du plan (l'API publique est une fonctionnalité facturée)", () => {
    const plainKey = 'bsk_plan123';

    function mockValidKey() {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        tenantId: 'tenant-1',
        keyHash: hashApiKey(plainKey),
        revokedAt: null,
      });
    }

    it("refuse une clé valide dont le plan n'inclut pas l'API publique", async () => {
      mockValidKey();
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE' });

      await expect(guard.canActivate(buildContext({ 'x-api-key': plainKey }))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuse aussi côté GraphQL, qui passe par le même guard', async () => {
      mockValidKey();
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'BUSINESS' });

      await expect(
        guard.canActivate(buildGraphqlContext({ 'x-api-key': plainKey })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorise sur un plan qui inclut la fonctionnalité', async () => {
      mockValidKey();
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'PREMIUM' });

      await expect(guard.canActivate(buildContext({ 'x-api-key': plainKey }))).resolves.toBe(true);
    });
  });
});
