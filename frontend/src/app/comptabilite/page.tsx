'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Wallet, Banknote } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { AccountingSummary, ReportPeriod } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  day: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  year: 'Cette année',
  custom: 'Personnalisée',
};

export default function ComptabilitePage() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!from || !to)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      if (period === 'custom') {
        if (from) params.set('from', new Date(from).toISOString());
        if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
      }
      const result = await api.get<AccountingSummary>(`/accounting/summary?${params.toString()}`);
      setSummary(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le résumé comptable.');
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell adminOnly>
      <div className="mx-auto max-w-4xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Comptabilité</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Vue d'ensemble des recettes, dépenses, pertes et trésorerie.
        </p>

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
          </div>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}
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

        {!error && !loading && summary && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-xs uppercase">Recettes</p>
              </div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatXOF(summary.revenue)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                {summary.salesCount} vente{summary.salesCount > 1 ? 's' : ''}
              </p>
            </Card>

            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <p className="text-xs uppercase">Dépenses</p>
              </div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatXOF(summary.expenses)}
              </p>
            </Card>

            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs uppercase">Pertes (stock)</p>
              </div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatXOF(summary.losses)}
              </p>
            </Card>

            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                <Wallet className="h-4 w-4 text-brand-600" />
                <p className="text-xs uppercase">Bénéfice net</p>
              </div>
              <p
                className={`text-lg font-semibold ${
                  summary.netProfit < 0 ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {formatXOF(summary.netProfit)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                Recettes − coût des ventes − dépenses − pertes
              </p>
            </Card>

            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
                <Banknote className="h-4 w-4 text-brand-600" />
                <p className="text-xs uppercase">Trésorerie</p>
              </div>
              <p
                className={`text-lg font-semibold ${
                  summary.cashFlow < 0 ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {formatXOF(summary.cashFlow)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                Encaissements réels − décaissements (ventes à crédit exclues)
              </p>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
