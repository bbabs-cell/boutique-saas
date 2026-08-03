import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { PlatformSecretGuard } from './platform-secret.guard';

function buildContext(headers: Record<string, string>) {
  const req = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('PlatformSecretGuard', () => {
  let guard: PlatformSecretGuard;
  const originalSecret = process.env.PLATFORM_ADMIN_SECRET;

  beforeEach(() => {
    guard = new PlatformSecretGuard();
  });

  afterEach(() => {
    process.env.PLATFORM_ADMIN_SECRET = originalSecret;
  });

  it('autorise quand le secret fourni correspond', () => {
    process.env.PLATFORM_ADMIN_SECRET = 'super-secret';
    const context = buildContext({ 'x-platform-secret': 'super-secret' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('refuse un secret incorrect', () => {
    process.env.PLATFORM_ADMIN_SECRET = 'super-secret';
    const context = buildContext({ 'x-platform-secret': 'mauvais-secret' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('refuse une requête sans secret', () => {
    process.env.PLATFORM_ADMIN_SECRET = 'super-secret';
    const context = buildContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("refuse par défaut (fail closed) si PLATFORM_ADMIN_SECRET n'est pas configuré côté serveur", () => {
    delete process.env.PLATFORM_ADMIN_SECRET;
    const context = buildContext({ 'x-platform-secret': 'peu-importe' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
