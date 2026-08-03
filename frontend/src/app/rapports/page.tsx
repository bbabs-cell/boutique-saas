'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import {
  Category,
  Employee,
  PaginatedProducts,
  Product,
  ReportPeriod,
  SalesReport,
} from '@/lib/types';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  day: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  year: 'Cette année',
  custom: 'Personnalisée',
};

export default function RapportsPage() {
  const { user } = useAuth();

  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      api.get<Employee[]>('/users').then(setEmployees).catch(() => {});
    }
    api
      .get<PaginatedProducts>('/products?pageSize=100')
      .then((res) => setProducts(res.items))
      .catch(() => {});
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  }, [user?.role]);

  function buildQuery() {
    const params = new URLSearchParams();
    params.set('period', period);
    if (period === 'custom') {
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
    }
    if (userId) params.set('userId', userId);
    if (productId) params.set('productId', productId);
    if (categoryId) params.set('categoryId', categoryId);
    return params.toString();
  }

  const load = useCallback(async () => {
    if (period === 'custom' && (!from || !to)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<SalesReport>(`/reports/sales?${buildQuery()}`);
      setReport(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le rapport.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, from, to, userId, productId, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const blob = await api.getBlob(`/reports/sales/pdf?${buildQuery()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-ventes.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "L'export PDF a échoué.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const blob = await api.getBlob(`/reports/sales/excel?${buildQuery()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-ventes.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "L'export Excel a échoué.");
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Rapports</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Chiffre d'affaires, nombre de ventes et bénéfice sur la période choisie.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExportExcel} loading={exportingExcel} disabled={!report}>
              <Download className="h-4 w-4" />
              Exporter en Excel
            </Button>
            <Button onClick={handleExportPdf} loading={exporting} disabled={!report}>
              <Download className="h-4 w-4" />
              Exporter en PDF
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="period">Période</Label>
              <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)}>
                {(Object.keys(PERIOD_LABELS) as ReportPeriod[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <Label htmlFor="from">Du</Label>
                  <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="to">Au</Label>
                  <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <div>
                <Label htmlFor="vendor">Vendeur</Label>
                <Select id="vendor" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-40">
                  <option value="">Tous</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="product">Produit</Label>
              <Select id="product" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-44">
                <option value="">Tous</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-44"
              >
                <option value="">Toutes</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        {!error && loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}
        {!error && !loading && period === 'custom' && (!from || !to) && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Sélectionnez une date de début et de fin pour la période personnalisée.
          </p>
        )}

        {!error && !loading && report && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-xs uppercase text-zinc-500 dark:text-zinc-500">Chiffre d'affaires</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatXOF(report.summary.revenue)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs uppercase text-zinc-500 dark:text-zinc-500">Nombre de ventes</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {report.summary.salesCount}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs uppercase text-zinc-500 dark:text-zinc-500">Bénéfice estimé</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatXOF(report.summary.profit)}
                </p>
              </Card>
            </div>

            <Card className="overflow-hidden">
              {report.sales.length === 0 ? (
                <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
                  Aucune vente sur cette période avec ces filtres.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Vendeur</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Paiement</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sales.map((sale) => (
                      <tr
                        key={sale.id}
                        onClick={() => (window.location.href = `/ventes/${sale.id}`)}
                        className="cursor-pointer border-b border-border-light last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                      >
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                          {new Date(sale.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{sale.user.name}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {sale.customer?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {sale.payments.map((p) => PAYMENT_METHOD_LABELS[p.method]).join(' + ')}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {formatXOF(sale.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
