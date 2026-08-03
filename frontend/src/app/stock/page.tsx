'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, Minus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Product, PaginatedProducts, PaginatedStockMovements, StockMovementType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  SALE: 'Vente',
  ADJUSTMENT: 'Ajustement',
  RESTOCK: 'Réapprovisionnement',
};

export default function StockPage() {
  const [alerts, setAlerts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<PaginatedStockMovements | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const result = await api.get<Product[]>('/stock/alerts');
      setAlerts(result);
    } catch (err) {
      setAlertsError(err instanceof ApiError ? err.message : 'Impossible de charger les alertes.');
    }
  }, []);

  const loadMovements = useCallback(async () => {
    try {
      const result = await api.get<PaginatedStockMovements>('/stock/movements?pageSize=30');
      setMovements(result);
    } catch (err) {
      setMovementsError(err instanceof ApiError ? err.message : "Impossible de charger l'historique.");
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    loadMovements();
    api
      .get<PaginatedProducts>('/products?pageSize=100')
      .then((res) => setProducts(res.items))
      .catch(() => {});
  }, [loadAlerts, loadMovements]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!productId || !quantity) {
      setFormError('Sélectionnez un produit et une quantité.');
      return;
    }
    const signedQuantity = direction === 'in' ? Math.abs(Number(quantity)) : -Math.abs(Number(quantity));
    setSubmitting(true);
    try {
      await api.post('/stock/adjustments', {
        productId,
        quantity: signedQuantity,
        reason: reason.trim() || null,
      });
      setProductId('');
      setQuantity('');
      setReason('');
      loadAlerts();
      loadMovements();
      const res = await api.get<PaginatedProducts>('/products?pageSize=100');
      setProducts(res.items);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "L'ajustement a échoué.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Stock</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Alertes */}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertes de stock faible
            </h2>
            {alertsError && <p className="text-sm text-red-500">{alertsError}</p>}
            {!alertsError && alerts.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                Aucun produit sous son seuil d'alerte pour le moment.
              </p>
            )}
            {alerts.length > 0 && (
              <ul className="space-y-2">
                {alerts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-900/20"
                  >
                    <span className="text-zinc-800 dark:text-zinc-200">{p.name}</span>
                    <span className="text-amber-700 dark:text-amber-400">
                      Stock {p.stock} / seuil {p.lowStockThreshold}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Formulaire d'ajustement */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Ajuster le stock manuellement
            </h2>
            <form onSubmit={handleAdjust} className="space-y-3">
              <div>
                <Label htmlFor="product">Produit</Label>
                <Select id="product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Sélectionner un produit…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stock actuel : {p.stock})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={direction === 'in' ? 'primary' : 'secondary'}
                  onClick={() => setDirection('in')}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4" />
                  Entrée
                </Button>
                <Button
                  type="button"
                  variant={direction === 'out' ? 'primary' : 'secondary'}
                  onClick={() => setDirection('out')}
                  className="flex-1"
                >
                  <Minus className="h-4 w-4" />
                  Sortie
                </Button>
              </div>
              <div>
                <Label htmlFor="quantity">Quantité</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reason">Motif (optionnel)</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex : comptage physique, produit périmé…"
                />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <Button type="submit" loading={submitting} className="w-full">
                Enregistrer l'ajustement
              </Button>
            </form>
          </Card>
        </div>

        {/* Historique des mouvements */}
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border-light px-5 py-3 dark:border-border-dark">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Historique des mouvements
            </h2>
          </div>
          {movementsError && <p className="p-4 text-sm text-red-500">{movementsError}</p>}
          {!movementsError && movements && movements.items.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
              Aucun mouvement de stock enregistré.
            </p>
          )}
          {!movementsError && movements && movements.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Produit</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Quantité</th>
                  <th className="px-4 py-2.5 font-medium">Motif</th>
                  <th className="px-4 py-2.5 font-medium">Par</th>
                </tr>
              </thead>
              <tbody>
                {movements.items.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border-light last:border-0 dark:border-border-dark"
                  >
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-500">
                      {new Date(m.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200">{m.product.name}</td>
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-500">
                      {MOVEMENT_TYPE_LABELS[m.type]}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-medium ${
                        m.quantity >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                      }`}
                    >
                      {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-500">{m.reason ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-500">{m.user.name}</td>
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
