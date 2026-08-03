'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { PaginatedSuppliers } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function FournisseursPage() {
  const [data, setData] = useState<PaginatedSuppliers | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', '20');
      const result = await api.get<PaginatedSuppliers>(`/suppliers?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les fournisseurs.');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Fournisseurs</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {data ? `${data.total} fournisseur${data.total > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <Link href="/fournisseurs/nouveau">
            <Button>
              <Plus className="h-4 w-4" />
              Ajouter un fournisseur
            </Button>
          </Link>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Rechercher par nom ou téléphone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && loading && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          )}
          {!error && !loading && data && data.items.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aucun fournisseur</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Ajoutez un fournisseur pour passer une commande.
              </p>
            </div>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Téléphone</th>
                  <th className="px-4 py-3 font-medium">Solde dû</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => (window.location.href = `/fournisseurs/${s.id}`)}
                    className="cursor-pointer border-b border-border-light last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{s.name}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          s.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'
                        }`}
                      >
                        {formatXOF(s.balance)}
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
