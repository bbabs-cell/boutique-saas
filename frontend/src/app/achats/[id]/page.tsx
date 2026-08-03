'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, PackageCheck, ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { PurchaseOrder, PurchaseOrderStatus } from '@/lib/types';
import { formatXOF } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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

export default function DetailAchatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);

  function load() {
    api
      .get<PurchaseOrder>(`/purchase-orders/${params.id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Commande introuvable.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleReceive() {
    if (!confirm('Marquer cette commande comme reçue ? Le stock sera incrémenté et le coût des produits mis à jour.')) {
      return;
    }
    setReceiving(true);
    try {
      await api.post(`/purchase-orders/${params.id}/receive`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Réception impossible.');
    } finally {
      setReceiving(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-2xl px-8 py-8">
        <button
          onClick={() => router.push('/achats')}
          className="mb-4 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !order && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {order && (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Commande —{' '}
                    <Link href={`/fournisseurs/${order.supplier.id}`} className="text-brand-600 hover:underline">
                      {order.supplier.name}
                    </Link>
                  </h1>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  {new Date(order.createdAt).toLocaleString('fr-FR')} — par {order.user.name}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>

            {(order.status === 'DRAFT' || order.status === 'ORDERED') && (
              <div className="mb-6">
                <Button onClick={handleReceive} loading={receiving}>
                  <PackageCheck className="h-4 w-4" />
                  Marquer comme reçue
                </Button>
              </div>
            )}

            {order.status === 'RECEIVED' && order.receivedAt && (
              <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                Réceptionnée le {new Date(order.receivedAt).toLocaleString('fr-FR')} — stock et coûts mis à
                jour, dette fournisseur augmentée de {formatXOF(order.total)}.
              </div>
            )}

            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Quantité</th>
                    <th className="px-4 py-3 font-medium">Coût unitaire</th>
                    <th className="px-4 py-3 font-medium">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-border-light last:border-0 dark:border-border-dark">
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{item.product.name}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{item.quantity}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatXOF(item.unitCost)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {formatXOF(item.quantity * item.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between border-t border-border-light px-4 py-3 text-base font-semibold text-zinc-900 dark:border-border-dark dark:text-zinc-100">
                <span>Total</span>
                <span>{formatXOF(order.total)}</span>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
