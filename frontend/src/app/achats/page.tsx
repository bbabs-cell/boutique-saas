'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { PaginatedPurchaseOrders, PurchaseOrderStatus } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, Card } from '@/components/ui/card';

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Brouillon',
  ORDERED: 'Commandée',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  ORDERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600',
};

export default function AchatsPage() {
  const [data, setData] = useState<PaginatedPurchaseOrders | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('pageSize', '20');
      const result = await api.get<PaginatedPurchaseOrders>(`/purchase-orders?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Commandes d'achat</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {data ? `${data.total} commande${data.total > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <Link href="/achats/nouveau">
            <Button>
              <Plus className="h-4 w-4" />
              Nouvelle commande
            </Button>
          </Link>
        </div>

        <div className="mb-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABELS) as PurchaseOrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && loading && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          )}
          {!error && !loading && data && data.items.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aucune commande</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Passez une commande à un fournisseur pour réapprovisionner votre stock.
              </p>
            </div>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Articles</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => (window.location.href = `/achats/${po.id}`)}
                    className="cursor-pointer border-b border-border-light last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                      {new Date(po.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{po.supplier.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {po.items.reduce((sum, i) => sum + i.quantity, 0)} article
                      {po.items.reduce((sum, i) => sum + i.quantity, 0) > 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {formatXOF(po.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[po.status]}`}>
                        {STATUS_LABELS[po.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-500">
            <span>
              Page {data.page} sur {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
