'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { PaginatedProducts, PaginatedSuppliers, Product, PurchaseOrder, Supplier } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

interface OrderLine {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
}

export default function NouvelAchatPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([
    { id: crypto.randomUUID(), productId: '', quantity: '', unitCost: '' },
  ]);
  const [status, setStatus] = useState<'DRAFT' | 'ORDERED'>('DRAFT');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<PaginatedSuppliers>('/suppliers?pageSize=100')
      .then((res) => setSuppliers(res.items))
      .catch(() => {});
    api
      .get<PaginatedProducts>('/products?pageSize=100')
      .then((res) => setProducts(res.items))
      .catch(() => {});
  }, []);

  function addLine() {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), productId: '', quantity: '', unitCost: '' }]);
  }

  function updateLine(id: string, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  // Pré-remplit le coût avec le coût actuel du produit sélectionné, pour aller plus vite.
  function handleProductChange(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(lineId, { productId, unitCost: product ? String(product.cost) : '' });
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Sélectionnez un fournisseur.');
      return;
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setError('Ajoutez au moins une ligne avec un produit et une quantité.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await api.post<PurchaseOrder>('/purchase-orders', {
        supplierId,
        status,
        items: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
        })),
      });
      router.push(`/achats/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Nouvelle commande d'achat
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Sélectionnez un fournisseur, les produits et les quantités commandées.
        </p>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="supplier">Fournisseur</Label>
              <Select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Sélectionner un fournisseur…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {suppliers.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Aucun fournisseur — créez-en un d'abord depuis « Fournisseurs ».
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Articles commandés</p>
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.id} className="flex gap-2">
                    <Select
                      value={line.productId}
                      onChange={(e) => handleProductChange(line.id, e.target.value)}
                      className="flex-1"
                    >
                      <option value="">Produit…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qté"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                      className="w-24"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Coût unitaire"
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.id, { unitCost: e.target.value })}
                      className="w-36"
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addLine}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter une ligne
              </button>
            </div>

            <div>
              <Label htmlFor="status">Statut initial</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ORDERED')}
                className="w-48"
              >
                <option value="DRAFT">Brouillon</option>
                <option value="ORDERED">Commandée</option>
              </Select>
            </div>

            <div className="flex justify-between border-t border-border-light pt-4 text-base font-semibold text-zinc-900 dark:border-border-dark dark:text-zinc-100">
              <span>Total estimé</span>
              <span>{formatXOF(total)}</span>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" loading={submitting}>
                Créer la commande
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/achats')}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
