'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { PaginatedSales } from '@/lib/types';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export default function VentesPage() {
  const [data, setData] = useState<PaginatedSales | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
      params.set('page', String(page));
      params.set('pageSize', '20');
      const result = await api.get<PaginatedSales>(`/sales?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les ventes.');
    } finally {
      setLoading(false);
    }
  }, [from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [from, to]);

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'CAISSIER']}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Historique des ventes</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {data ? `${data.total} vente${data.total > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <Link href="/caisse">
            <Button>
              <Receipt className="h-4 w-4" />
              Nouvelle vente
            </Button>
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="from">Du</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Au</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && loading && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          )}
          {!error && !loading && data && data.items.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aucune vente</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Les ventes encaissées apparaîtront ici.
              </p>
            </div>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Vendeur</th>
                  <th className="px-4 py-3 font-medium">Articles</th>
                  <th className="px-4 py-3 font-medium">Paiement</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => (window.location.href = `/ventes/${sale.id}`)}
                    className="cursor-pointer border-b border-border-light last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(sale.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{sale.user.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {sale.items.reduce((sum, i) => sum + i.quantity, 0)} article
                      {sale.items.reduce((sum, i) => sum + i.quantity, 0) > 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {sale.payments.map((p) => PAYMENT_METHOD_LABELS[p.method]).join(' + ')}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {formatXOF(sale.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          sale.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'
                        }`}
                      >
                        {sale.status === 'COMPLETED' ? 'Validée' : 'Annulée'}
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
