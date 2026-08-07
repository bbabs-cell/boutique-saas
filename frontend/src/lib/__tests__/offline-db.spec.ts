import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// L'appel réseau est le seul point à simuler : tout le reste (Dexie, IndexedDB, transactions)
// s'exécute réellement, ce qui est précisément l'intérêt de ces tests.
const post = vi.fn();
vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: (...args: unknown[]) => post(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

const {
  offlineDb,
  queueOfflineSale,
  getPendingCount,
  getPendingSales,
  syncPendingSales,
  discardPendingSale,
  retryPendingSale,
} = await import('../offline-db');

const VENTE = {
  items: [{ productId: 'p1', productName: 'Riz 5kg', quantity: 2, unitPrice: 5000 }],
  discount: 0,
  payments: [{ method: 'CASH' as const, amount: 10000 }],
  customerId: null,
  customerName: null,
  storeId: 's1',
  total: 10000,
};

async function queueSales(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(await queueOfflineSale(VENTE));
  }
  return ids;
}

describe('offline-db', () => {
  beforeEach(async () => {
    post.mockReset();
    await offlineDb.pendingSales.clear();
    await offlineDb.products.clear();
  });

  afterEach(async () => {
    await offlineDb.pendingSales.clear();
  });

  describe('mise en file', () => {
    it('enregistre la vente et décrémente le stock local', async () => {
      await offlineDb.products.add({
        id: 'p1',
        name: 'Riz 5kg',
        barcode: null,
        price: 5000,
        cost: 3000,
        lowStockThreshold: null,
        categoryId: null,
        stock: 10,
      });

      const id = await queueOfflineSale(VENTE);

      expect(id).toBeTruthy();
      expect(await getPendingCount()).toBe(1);
      expect((await offlineDb.products.get('p1'))?.stock).toBe(8);
    });

    it('ne fait jamais descendre le stock local sous zéro', async () => {
      await offlineDb.products.add({
        id: 'p1',
        name: 'Riz 5kg',
        barcode: null,
        price: 5000,
        cost: 3000,
        lowStockThreshold: null,
        categoryId: null,
        stock: 1,
      });

      await queueOfflineSale(VENTE); // 2 unités demandées pour 1 en stock

      expect((await offlineDb.products.get('p1'))?.stock).toBe(0);
    });

    it('donne un identifiant distinct à chaque vente, base de la déduplication serveur', async () => {
      const ids = await queueSales(3);

      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('synchronisation', () => {
    it('retire de la file les ventes acceptées', async () => {
      const [id] = await queueSales(1);
      post.mockResolvedValue({ results: [{ clientSaleId: id, status: 'accepted', saleId: 'sale-1' }] });

      const result = await syncPendingSales();

      expect(result).toEqual({ synced: 1, conflicts: 0 });
      expect(await getPendingCount()).toBe(0);
    });

    it('traite « déjà synchronisée » comme un succès, pas comme une erreur', async () => {
      const [id] = await queueSales(1);
      post.mockResolvedValue({ results: [{ clientSaleId: id, status: 'already_synced', saleId: 's1' }] });

      const result = await syncPendingSales();

      expect(result.synced).toBe(1);
      expect(await getPendingCount()).toBe(0);
    });

    it('conserve les ventes en conflit avec leur motif, pour arbitrage manuel', async () => {
      const [id] = await queueSales(1);
      post.mockResolvedValue({
        results: [{ clientSaleId: id, status: 'conflict', reason: 'Stock insuffisant' }],
      });

      const result = await syncPendingSales();

      expect(result).toEqual({ synced: 0, conflicts: 1 });
      const [enAttente] = await getPendingSales();
      expect(enAttente.status).toBe('conflict');
      expect(enAttente.conflictReason).toBe('Stock insuffisant');
    });

    it('ne perd aucune vente si le réseau tombe : elles repassent en attente', async () => {
      await queueSales(2);
      post.mockRejectedValue(new Error('réseau indisponible'));

      await expect(syncPendingSales()).rejects.toThrow();

      const enAttente = await getPendingSales();
      expect(enAttente).toHaveLength(2);
      // « syncing » est un état transitoire : une vente qui y resterait coincée ne serait
      // plus jamais renvoyée, et la vente serait silencieusement perdue.
      expect(enAttente.every((s) => s.status === 'pending')).toBe(true);
    });

    it('ne fait rien quand la file est vide', async () => {
      const result = await syncPendingSales();

      expect(result).toEqual({ synced: 0, conflicts: 0 });
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('découpage en lots', () => {
    it('découpe en lots de 50 au maximum, la limite acceptée par le serveur', async () => {
      await queueSales(120);
      post.mockImplementation(async (_path: string, body: any) => ({
        results: body.sales.map((s: any) => ({ clientSaleId: s.clientSaleId, status: 'accepted' })),
      }));

      const result = await syncPendingSales();

      expect(post).toHaveBeenCalledTimes(3);
      const tailles = post.mock.calls.map(([, body]: any) => body.sales.length);
      expect(tailles).toEqual([50, 50, 20]);
      expect(result.synced).toBe(120);
      expect(await getPendingCount()).toBe(0);
    });

    it('conserve les lots déjà acceptés quand un lot suivant échoue', async () => {
      await queueSales(60);
      let appel = 0;
      post.mockImplementation(async (_path: string, body: any) => {
        appel++;
        if (appel === 2) throw new Error('réseau coupé au milieu');
        return {
          results: body.sales.map((s: any) => ({ clientSaleId: s.clientSaleId, status: 'accepted' })),
        };
      });

      await expect(syncPendingSales()).rejects.toThrow();

      // Le premier lot est acquis, seul le second est à renvoyer : c'est tout l'intérêt du
      // découpage face à une connexion instable.
      expect(await getPendingCount()).toBe(10);
    });
  });

  describe('arbitrage des conflits', () => {
    it('abandonne définitivement une vente en conflit', async () => {
      const [id] = await queueSales(1);

      await discardPendingSale(id);

      expect(await getPendingCount()).toBe(0);
    });

    it('remet une vente en conflit dans la file, sans son motif', async () => {
      const [id] = await queueSales(1);
      post.mockResolvedValue({
        results: [{ clientSaleId: id, status: 'conflict', reason: 'Stock insuffisant' }],
      });
      await syncPendingSales();

      await retryPendingSale(id);

      const [vente] = await getPendingSales();
      expect(vente.status).toBe('pending');
      expect(vente.conflictReason).toBeUndefined();
    });
  });
});
