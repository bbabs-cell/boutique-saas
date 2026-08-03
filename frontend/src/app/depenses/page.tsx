'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { PaginatedExpenses } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function DepensesPage() {
  const [data, setData] = useState<PaginatedExpenses | null>(null);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      params.set('page', String(page));
      params.set('pageSize', '20');
      const result = await api.get<PaginatedExpenses>(`/expenses?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les dépenses.');
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [category]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!label.trim() || Number(amount) <= 0) {
      setFormError('Indiquez un libellé et un montant valide.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/expenses', {
        label: label.trim(),
        amount: Number(amount),
        category: newCategory.trim() || null,
      });
      setLabel('');
      setAmount('');
      setNewCategory('');
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, expenseLabel: string) {
    if (!confirm(`Supprimer la dépense « ${expenseLabel} » ?`)) return;
    try {
      await api.delete(`/expenses/${id}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <AppShell adminOnly>
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Dépenses</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {data ? `${data.total} dépense${data.total > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Ajouter une dépense
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 p-5">
            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <Label htmlFor="label">Libellé</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex : Loyer du mois"
                />
              </div>
              <div className="w-36">
                <Label htmlFor="amount">Montant</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Label htmlFor="category">Catégorie (optionnel)</Label>
                <Input
                  id="category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ex : loyer"
                />
              </div>
              <Button type="submit" loading={submitting}>
                Enregistrer
              </Button>
            </form>
            {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}
          </Card>
        )}

        <div className="mb-4">
          <Input
            placeholder="Filtrer par catégorie…"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-56"
          />
        </div>

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && loading && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          )}
          {!error && !loading && data && data.items.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aucune dépense</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Enregistrez vos dépenses générales (loyer, salaires, transport…).
              </p>
            </div>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Libellé</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Par</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((exp) => (
                  <tr
                    key={exp.id}
                    className="border-b border-border-light last:border-0 dark:border-border-dark"
                  >
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                      {new Date(exp.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{exp.label}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">{exp.category ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {formatXOF(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">{exp.user.name}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(exp.id, exp.label)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
