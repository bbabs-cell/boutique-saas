import Dexie, { Table } from 'dexie';
import { api, ApiError } from './api';

// === Schéma ===

export interface OfflineProduct {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  cost: number;
  lowStockThreshold: number | null;
  categoryId: string | null;
  stock: number; // stock connu au dernier bootstrap, ajusté localement à chaque vente en attente
}

export interface OfflineCustomer {
  id: string;
  name: string;
  phone: string | null;
  creditLimit: number | null;
  creditBalance: number;
}

export interface OfflineMeta {
  key: 'bootstrap';
  storeId: string;
  storeName: string;
  tenantName: string;
  currency: string;
  tvaEnabled: boolean;
  tvaRate: number;
  syncedAt: string;
}

export type PendingSaleStatus = 'pending' | 'syncing' | 'conflict';

export interface PendingSaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface PendingSalePayment {
  method: 'CASH' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'CARD' | 'CREDIT';
  amount: number;
  reference?: string | null;
}

export interface PendingSale {
  clientSaleId: string; // clé primaire, généré côté client (crypto.randomUUID())
  items: PendingSaleItem[];
  discount: number;
  payments: PendingSalePayment[];
  customerId: string | null;
  customerName: string | null;
  storeId: string;
  total: number;
  createdOfflineAt: string;
  status: PendingSaleStatus;
  conflictReason?: string;
}

class OfflineDatabase extends Dexie {
  products!: Table<OfflineProduct, string>;
  customers!: Table<OfflineCustomer, string>;
  meta!: Table<OfflineMeta, string>;
  pendingSales!: Table<PendingSale, string>;

  constructor() {
    super('boutique-saas-offline');
    this.version(1).stores({
      products: 'id, barcode, name',
      customers: 'id, name, phone',
      meta: 'key',
      pendingSales: 'clientSaleId, status, storeId, createdOfflineAt',
    });
  }
}

export const offlineDb = new OfflineDatabase();

// === Amorçage du cache (bootstrap) ===

interface BootstrapResponse {
  tenant: { name: string; currency: string; tvaEnabled: boolean; tvaRate: number };
  store: { id: string; name: string };
  products: OfflineProduct[];
  customers: OfflineCustomer[];
  syncedAt: string;
}

/** Recharge entièrement le cache local depuis le serveur — à appeler dès qu'une connexion est disponible. */
export async function bootstrapOfflineCache(storeId: string): Promise<void> {
  const data = await api.get<BootstrapResponse>(`/sync/bootstrap?storeId=${encodeURIComponent(storeId)}`);

  await offlineDb.transaction('rw', offlineDb.products, offlineDb.customers, offlineDb.meta, async () => {
    await offlineDb.products.clear();
    await offlineDb.products.bulkAdd(data.products);
    await offlineDb.customers.clear();
    await offlineDb.customers.bulkAdd(data.customers);
    await offlineDb.meta.put({
      key: 'bootstrap',
      storeId: data.store.id,
      storeName: data.store.name,
      tenantName: data.tenant.name,
      currency: data.tenant.currency,
      tvaEnabled: data.tenant.tvaEnabled,
      tvaRate: data.tenant.tvaRate,
      syncedAt: data.syncedAt,
    });
  });
}

export async function getOfflineMeta(): Promise<OfflineMeta | undefined> {
  return offlineDb.meta.get('bootstrap');
}

export async function hasOfflineCacheForStore(storeId: string): Promise<boolean> {
  const meta = await getOfflineMeta();
  return meta?.storeId === storeId;
}

// === File de ventes en attente ===

/** Met une vente en file d'attente et décrémente le stock local (optimiste, pour un affichage
 *  cohérent si plusieurs ventes hors-ligne portent sur le même produit avant resynchronisation).
 *  Le serveur revérifiera tout à la synchro : ceci n'est qu'un affichage local provisoire. */
export async function queueOfflineSale(input: {
  items: PendingSaleItem[];
  discount: number;
  payments: PendingSalePayment[];
  customerId: string | null;
  customerName: string | null;
  storeId: string;
  total: number;
}): Promise<string> {
  const clientSaleId = crypto.randomUUID();

  await offlineDb.transaction('rw', offlineDb.pendingSales, offlineDb.products, async () => {
    await offlineDb.pendingSales.add({
      clientSaleId,
      items: input.items,
      discount: input.discount,
      payments: input.payments,
      customerId: input.customerId,
      customerName: input.customerName,
      storeId: input.storeId,
      total: input.total,
      createdOfflineAt: new Date().toISOString(),
      status: 'pending',
    });

    for (const item of input.items) {
      const product = await offlineDb.products.get(item.productId);
      if (product) {
        await offlineDb.products.update(item.productId, {
          stock: Math.max(0, product.stock - item.quantity),
        });
      }
    }
  });

  return clientSaleId;
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return offlineDb.pendingSales.orderBy('createdOfflineAt').toArray();
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.pendingSales.where('status').anyOf(['pending', 'conflict']).count();
}

// === Synchronisation ===

interface SyncSaleResult {
  clientSaleId: string;
  status: 'accepted' | 'already_synced' | 'conflict';
  saleId?: string;
  reason?: string;
}

/** Envoie toutes les ventes en attente au serveur. Les ventes acceptées ou déjà connues sont
 *  retirées de la file locale ; celles en conflit y restent, marquées, pour résolution manuelle. */
export async function syncPendingSales(): Promise<{ synced: number; conflicts: number }> {
  const pending = await offlineDb.pendingSales.where('status').equals('pending').sortBy('createdOfflineAt');
  if (pending.length === 0) {
    return { synced: 0, conflicts: 0 };
  }

  await offlineDb.pendingSales.where('status').equals('pending').modify({ status: 'syncing' });

  let results: SyncSaleResult[];
  try {
    const res = await api.post<{ results: SyncSaleResult[] }>('/sync/sales', {
      sales: pending.map((sale) => ({
        clientSaleId: sale.clientSaleId,
        items: sale.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discount: sale.discount,
        payments: sale.payments,
        customerId: sale.customerId,
        storeId: sale.storeId,
        createdOfflineAt: sale.createdOfflineAt,
      })),
    });
    results = res.results;
  } catch (err) {
    // Le lot entier n'a pas pu être envoyé (ex. connexion perdue en cours de route) : les
    // ventes repassent en attente pour la prochaine tentative, rien n'est perdu.
    await offlineDb.pendingSales.where('status').equals('syncing').modify({ status: 'pending' });
    throw err instanceof ApiError ? err : new Error('La synchronisation a échoué.');
  }

  let synced = 0;
  let conflicts = 0;

  await offlineDb.transaction('rw', offlineDb.pendingSales, async () => {
    for (const result of results) {
      if (result.status === 'accepted' || result.status === 'already_synced') {
        await offlineDb.pendingSales.delete(result.clientSaleId);
        synced++;
      } else {
        await offlineDb.pendingSales.update(result.clientSaleId, {
          status: 'conflict',
          conflictReason: result.reason ?? 'Conflit non précisé.',
        });
        conflicts++;
      }
    }
  });

  return { synced, conflicts };
}

/** Abandonne une vente en conflit (ex. le commerçant décide de ne pas la resaisir). */
export async function discardPendingSale(clientSaleId: string): Promise<void> {
  await offlineDb.pendingSales.delete(clientSaleId);
}

/** Remet une vente en conflit dans la file, pour une nouvelle tentative de synchro
 *  (ex. après avoir réapprovisionné le stock manquant). */
export async function retryPendingSale(clientSaleId: string): Promise<void> {
  await offlineDb.pendingSales.update(clientSaleId, { status: 'pending', conflictReason: undefined });
}
