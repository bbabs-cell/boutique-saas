'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  Wallet,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { DashboardSummary, RevenueChartPoint, TopProduct, Sale } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chart, setChart] = useState<RevenueChartPoint[] | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[] | null>(null);
  const [recentActivity, setRecentActivity] = useState<Sale[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardSummary>('/dashboard/summary'),
      api.get<RevenueChartPoint[]>('/dashboard/revenue-chart'),
      api.get<TopProduct[]>('/dashboard/top-products?limit=5'),
      api.get<Sale[]>('/dashboard/recent-activity?limit=8'),
    ])
      .then(([s, c, t, a]) => {
        setSummary(s);
        setChart(c);
        setTopProducts(t);
        setRecentActivity(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger le tableau de bord.'));
  }, []);

  const loading = !summary || !chart || !topProducts || !recentActivity;

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Bonjour, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
          Voici un aperçu de {user?.tenantName}.
        </p>

        {error && <p className="mt-6 text-sm text-red-500">{error}</p>}

        {!error && loading && (
          <div className="mt-10 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {!error && summary && (
          <>
            {/* Cartes de synthèse */}
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-xs uppercase">CA aujourd'hui</p>
                </div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatXOF(summary.today.revenue)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                  {summary.today.salesCount} vente{summary.today.salesCount > 1 ? 's' : ''}
                </p>
              </Card>
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                  <Receipt className="h-4 w-4" />
                  <p className="text-xs uppercase">CA ce mois</p>
                </div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatXOF(summary.month.revenue)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                  {summary.month.salesCount} vente{summary.month.salesCount > 1 ? 's' : ''}
                </p>
              </Card>
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                  <Wallet className="h-4 w-4" />
                  <p className="text-xs uppercase">Bénéfice ce mois</p>
                </div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatXOF(summary.month.profit)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">Hors TVA collectée</p>
              </Card>
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-xs uppercase">Stock faible</p>
                </div>
                <p
                  className={`text-lg font-semibold ${
                    summary.lowStockCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {summary.lowStockCount} produit{summary.lowStockCount > 1 ? 's' : ''}
                </p>
                <Link href="/stock" className="mt-0.5 text-xs text-brand-600 hover:underline">
                  Voir les alertes
                </Link>
              </Card>
            </div>

            {/* Graphique CA sur 30 jours */}
            <Card className="mt-6 p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Chiffre d'affaires — 30 derniers jours
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart ?? []}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B6E5C" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3B6E5C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => d.slice(5)}
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatXOF(value), 'CA']}
                      labelFormatter={(label: string) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3B6E5C"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Top produits */}
              <Card className="overflow-hidden">
                <div className="border-b border-border-light px-5 py-3 dark:border-border-dark">
                  <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Produits les plus vendus
                  </h2>
                </div>
                {topProducts && topProducts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
                    Aucune vente enregistrée.
                  </p>
                ) : (
                  <ul>
                    {topProducts?.map((p, i) => (
                      <li
                        key={p.productId}
                        className="flex items-center justify-between border-b border-border-light px-5 py-2.5 text-sm last:border-0 dark:border-border-dark"
                      >
                        <span className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {i + 1}
                          </span>
                          {p.name}
                        </span>
                        <span className="text-right">
                          <span className="block font-medium text-zinc-800 dark:text-zinc-200">
                            {formatXOF(p.revenue)}
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-500">
                            {p.quantity} unités
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Activité récente */}
              <Card className="overflow-hidden">
                <div className="border-b border-border-light px-5 py-3 dark:border-border-dark">
                  <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Activité récente
                  </h2>
                </div>
                {recentActivity && recentActivity.length === 0 ? (
                  <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
                    Aucune vente pour le moment.
                  </p>
                ) : (
                  <ul>
                    {recentActivity?.map((sale) => (
                      <li key={sale.id}>
                        <Link
                          href={`/ventes/${sale.id}`}
                          className="flex items-center justify-between border-b border-border-light px-5 py-2.5 text-sm last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                        >
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {new Date(sale.createdAt).toLocaleString('fr-FR')} — {sale.user.name}
                          </span>
                          <span
                            className={`font-medium ${
                              sale.status === 'CANCELLED'
                                ? 'text-zinc-400 line-through'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {formatXOF(sale.total)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
