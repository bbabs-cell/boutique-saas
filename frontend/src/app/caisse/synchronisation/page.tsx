'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useOnlineStatus } from '@/lib/use-online-status';
import {
  discardPendingSale,
  getPendingSales,
  retryPendingSale,
  PendingSale,
} from '@/lib/offline-db';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STATUS_LABELS: Record<PendingSale['status'], string> = {
  pending: 'En attente de synchro',
  syncing: 'Synchronisation en cours…',
  conflict: 'Conflit — action requise',
};

export default function SynchronisationPage() {
  const { isOnline, syncing, triggerSync } = useOnlineStatus();
  const [sales, setSales] = useState<PendingSale[] | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function load() {
    const result = await getPendingSales();
    setSales(result);
  }

  useEffect(() => {
    load();
  }, [syncing]);

  async function handleSync() {
    await triggerSync();
    load();
  }

  async function handleRetry(clientSaleId: string) {
    setActioningId(clientSaleId);
    try {
      await retryPendingSale(clientSaleId);
      await load();
      if (isOnline) await triggerSync();
    } finally {
      setActioningId(null);
    }
  }

  async function handleDiscard(clientSaleId: string) {
    if (!confirm('Abandonner définitivement cette vente ? Elle ne sera jamais envoyée au serveur.')) return;
    setActioningId(clientSaleId);
    try {
      await discardPendingSale(clientSaleId);
      await load();
    } finally {
      setActioningId(null);
    }
  }

  const conflicts = sales?.filter((s) => s.status === 'conflict') ?? [];
  const pending = sales?.filter((s) => s.status !== 'conflict') ?? [];

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'CAISSIER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Synchronisation des ventes
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Ventes encaissées hors-ligne, en attente d'envoi au serveur.
            </p>
          </div>
          <Button onClick={handleSync} loading={syncing} disabled={!isOnline}>
            <RefreshCw className="h-4 w-4" />
            Synchroniser maintenant
          </Button>
        </div>

        {!isOnline && (
          <Card className="mb-6 flex items-center gap-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
            <WifiOff className="h-4 w-4 shrink-0" />
            Vous êtes hors-ligne : la synchronisation reprendra automatiquement dès que la
            connexion sera rétablie.
          </Card>
        )}

        {conflicts.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Conflits à résoudre ({conflicts.length})
            </h2>
            <div className="space-y-3">
              {conflicts.map((sale) => (
                <Card key={sale.clientSaleId} className="border-red-200 p-4 dark:border-red-900/50">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        {formatXOF(sale.total)} — {sale.items.length} article{sale.items.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Vente hors-ligne du {new Date(sale.createdOfflineAt).toLocaleString('fr-FR')}
                        {sale.customerName ? ` — ${sale.customerName}` : ''}
                      </p>
                    </div>
                  </div>
                  <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {sale.conflictReason}
                  </p>
                  <ul className="mb-3 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                    {sale.items.map((item) => (
                      <li key={item.productId}>
                        {item.quantity} × {item.productName}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      loading={actioningId === sale.clientSaleId}
                      onClick={() => handleRetry(sale.clientSaleId)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Réessayer
                    </Button>
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      loading={actioningId === sale.clientSaleId}
                      onClick={() => handleDiscard(sale.clientSaleId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Abandonner
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <Clock className="h-4 w-4" />
            En attente ({pending.length})
          </h2>
          {sales === null ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          ) : pending.length === 0 ? (
            <Card className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
              Aucune vente en attente — tout est synchronisé.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              {pending.map((sale) => (
                <div
                  key={sale.clientSaleId}
                  className="flex items-center justify-between border-b border-border-light px-4 py-3 text-sm last:border-0 dark:border-border-dark"
                >
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{formatXOF(sale.total)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      {new Date(sale.createdOfflineAt).toLocaleString('fr-FR')} —{' '}
                      {sale.payments.map((p) => PAYMENT_METHOD_LABELS[p.method]).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">
                    {STATUS_LABELS[sale.status]}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
