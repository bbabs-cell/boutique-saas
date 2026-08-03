import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { dispatchWebhookEvent } from './webhooks-helper';

function buildPrismaMock() {
  return {
    webhook: { findMany: vi.fn() },
  };
}

describe('dispatchWebhookEvent', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appelle uniquement les webhooks actifs abonnés à cet événement', async () => {
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', secret: 'secret-1', events: ['sale.created'] },
    ]);

    await dispatchWebhookEvent(prisma as any, 'tenant-1', 'sale.created', { saleId: 'sale-1' });

    expect(prisma.webhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', active: true, events: { has: 'sale.created' } }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/hook', expect.objectContaining({ method: 'POST' }));
  });

  it('signe le payload avec HMAC-SHA256 en utilisant le secret du webhook', async () => {
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://example.com/hook', secret: 'my-secret', events: ['sale.created'] },
    ]);

    await dispatchWebhookEvent(prisma as any, 'tenant-1', 'sale.created', { saleId: 'sale-1' });

    const [, options] = fetchSpy.mock.calls[0];
    const signature = options.headers['X-Webhook-Signature'];
    const expectedSignature = createHmac('sha256', 'my-secret').update(options.body).digest('hex');
    expect(signature).toBe(expectedSignature);
  });

  it("n'appelle aucun webhook si aucun n'est abonné à cet événement", async () => {
    prisma.webhook.findMany.mockResolvedValue([]);

    await dispatchWebhookEvent(prisma as any, 'tenant-1', 'sale.created', {});

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("n'échoue pas si l'appel HTTP vers le webhook échoue", async () => {
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'wh-1', url: 'https://exemple-injoignable.invalid', secret: 's', events: ['sale.created'] },
    ]);
    fetchSpy.mockRejectedValue(new Error('network error'));

    await expect(
      dispatchWebhookEvent(prisma as any, 'tenant-1', 'sale.created', {}),
    ).resolves.toBeUndefined();
  });
});
