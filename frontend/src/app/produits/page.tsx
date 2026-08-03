'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, Pencil, Download, Upload } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, ApiError } from '@/lib/api';
import { Category, PaginatedProducts } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/card';
import { Card } from '@/components/ui/card';

function formatXOF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

export default function ProduitsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'MAGASINIER';
  const [data, setData] = useState<PaginatedProducts | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      params.set('page', String(page));
      params.set('pageSize', '20');
      const result = await api.get<PaginatedProducts>(`/products?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, page]);

  useEffect(() => {
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer « ${name} » ? Cette action peut être annulée depuis la base de données.`)) {
      return;
    }
    try {
      await api.delete(`/products/${id}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.getBlob('/products/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogue-produits.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "L'export a échoué.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.postForm<{ createdCount: number; updatedCount: number; errorCount: number }>(
        '/products/import',
        formData,
      );
      setImportSummary(
        `${result.createdCount} créé(s), ${result.updatedCount} mis à jour, ${result.errorCount} erreur(s).`,
      );
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "L'import a échoué.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Produits</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {data ? `${data.total} produit${data.total > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExport} loading={exporting}>
              <Download className="h-4 w-4" />
              Exporter
            </Button>
            {canWrite && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button
                  variant="secondary"
                  loading={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Importer
                </Button>
              </>
            )}
            {canWrite && (
              <Link href="/produits/nouveau">
                <Button>
                  <Plus className="h-4 w-4" />
                  Ajouter un produit
                </Button>
              </Link>
            )}
          </div>
        </div>

        {importSummary && (
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{importSummary}</p>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-56">
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aucun produit</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Ajoutez votre premier produit pour commencer.
              </p>
            </div>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Code-barres</th>
                  <th className="px-4 py-3 font-medium">Prix</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border-light last:border-0 dark:border-border-dark"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{p.name}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                      {p.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">{p.barcode ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatXOF(p.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.stock <= 5
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canWrite && (
                        <div className="flex justify-end gap-1">
                          <Link href={`/produits/${p.id}`}>
                            <Button variant="ghost" className="px-2 py-1.5">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            className="px-2 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDelete(p.id, p.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
