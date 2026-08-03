import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

function buildPrismaMock() {
  return {
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

function buildContext(req: any) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

function buildCallHandler(responseBody: any = { id: 'entity-1' }) {
  return { handle: () => of(responseBody) } as any;
}

// Laisse le microtask du .catch()/.then() interne à l'intercepteur se résoudre avant d'assert.
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AuditInterceptor', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    prisma = buildPrismaMock();
    interceptor = new AuditInterceptor(prisma as any);
  });

  it('journalise une création (POST) avec l’action déduite de la route', async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/products' },
      params: {},
      body: { name: 'Riz 5kg' },
      user: { tenantId: 'tenant-1', userId: 'user-1' },
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler({ id: 'p1' })).subscribe(() => resolve());
    });
    await flush();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'products.create',
          entityType: 'products',
          entityId: 'p1',
        }),
      }),
    );
  });

  it('journalise une modification (PATCH) en utilisant l’id de la route', async () => {
    const req = {
      method: 'PATCH',
      route: { path: '/api/products/:id' },
      params: { id: 'p1' },
      body: { price: 6000 },
      user: { tenantId: 'tenant-1', userId: 'user-1' },
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler({ id: 'p1' })).subscribe(() => resolve());
    });
    await flush();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'products.update', entityId: 'p1' }),
      }),
    );
  });

  it('déduit une action spécifique pour une sous-route connue (ex. cancel)', async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/sales/:id/cancel' },
      params: { id: 'sale-1' },
      body: {},
      user: { tenantId: 'tenant-1', userId: 'user-1' },
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler({ id: 'sale-1' })).subscribe(() => resolve());
    });
    await flush();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'sales.cancel' }) }),
    );
  });

  it('ne journalise rien pour une requête GET', async () => {
    const req = { method: 'GET', route: { path: '/api/products' }, user: { tenantId: 'tenant-1', userId: 'user-1' } };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler()).subscribe(() => resolve());
    });
    await flush();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('ne journalise rien pour les routes auth (login, register…)', async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/auth/login' },
      body: { email: 'x@x.ml', password: 'secret' },
      user: undefined,
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler()).subscribe(() => resolve());
    });
    await flush();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("ne journalise rien si aucun utilisateur n'est authentifié", async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/products' },
      params: {},
      body: {},
      user: undefined,
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler()).subscribe(() => resolve());
    });
    await flush();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('retire les champs sensibles (mot de passe) des métadonnées journalisées', async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/users' },
      params: {},
      body: { name: 'Nouvel employé', password: 'secret123' },
      user: { tenantId: 'tenant-1', userId: 'user-1' },
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(buildContext(req), buildCallHandler({ id: 'u2' })).subscribe(() => resolve());
    });
    await flush();

    const call = prisma.auditLog.create.mock.calls[0][0];
    expect(call.data.metadata).toEqual({ name: 'Nouvel employé' });
  });
});
