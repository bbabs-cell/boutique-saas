import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifyStockLevel, NOTIFICATION_COOLDOWN_MS } from './notifications-helper';

function buildTx() {
  return {
    notification: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

const PRODUIT_SOUS_SEUIL = { id: 'p1', name: 'Riz 5kg', stock: 2, lowStockThreshold: 5 };

describe('notifyStockLevel', () => {
  let tx: ReturnType<typeof buildTx>;

  beforeEach(() => {
    tx = buildTx();
  });

  it('notifie un stock faible', async () => {
    await notifyStockLevel(tx as any, 'tenant-1', PRODUIT_SOUS_SEUIL);

    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'LOW_STOCK' }) }),
    );
  });

  it('notifie une rupture de stock', async () => {
    await notifyStockLevel(tx as any, 'tenant-1', { ...PRODUIT_SOUS_SEUIL, stock: 0 });

    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'OUT_OF_STOCK' }) }),
    );
  });

  it('ne notifie pas un stock au-dessus du seuil', async () => {
    await notifyStockLevel(tx as any, 'tenant-1', { ...PRODUIT_SOUS_SEUIL, stock: 20 });

    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('ne notifie pas un produit sans seuil défini', async () => {
    await notifyStockLevel(tx as any, 'tenant-1', {
      ...PRODUIT_SOUS_SEUIL,
      stock: 2,
      lowStockThreshold: null,
    });

    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  describe('déduplication', () => {
    it('ne recrée pas une notification déjà émise récemment pour le même produit', async () => {
      tx.notification.findFirst.mockResolvedValue({ id: 'notif-existante' });

      await notifyStockLevel(tx as any, 'tenant-1', PRODUIT_SOUS_SEUIL);

      // Sans cette règle, un article populaire en rupture génère une notification par vente :
      // la cloche devient illisible et l'alerte se perd dans le bruit.
      expect(tx.notification.create).not.toHaveBeenCalled();
    });

    it('cherche un doublon sur le bon produit, le bon type et la bonne fenêtre', async () => {
      const avant = Date.now();

      await notifyStockLevel(tx as any, 'tenant-1', PRODUIT_SOUS_SEUIL);

      const [{ where }] = tx.notification.findFirst.mock.calls[0];
      expect(where).toMatchObject({ tenantId: 'tenant-1', type: 'LOW_STOCK' });
      expect(where.message.contains).toBe('« Riz 5kg »');

      const seuilTemporel = (where.createdAt.gte as Date).getTime();
      expect(seuilTemporel).toBeGreaterThanOrEqual(avant - NOTIFICATION_COOLDOWN_MS - 1000);
      expect(seuilTemporel).toBeLessThanOrEqual(Date.now() - NOTIFICATION_COOLDOWN_MS + 1000);
    });

    it('distingue rupture et stock faible : une rupture passe malgré une alerte de stock faible récente', async () => {
      // findFirst filtre sur le type : une alerte LOW_STOCK récente ne doit pas masquer le
      // passage en rupture, qui est une information neuve et plus grave.
      tx.notification.findFirst.mockImplementation(async ({ where }: any) =>
        where.type === 'LOW_STOCK' ? { id: 'notif-existante' } : null,
      );

      await notifyStockLevel(tx as any, 'tenant-1', { ...PRODUIT_SOUS_SEUIL, stock: 0 });

      expect(tx.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'OUT_OF_STOCK' }) }),
      );
    });
  });
});
