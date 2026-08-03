'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Printer, Ban, ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Sale } from '@/lib/types';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DetailVentePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isNew = searchParams.get('nouvelle') === '1';

  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  function load() {
    api
      .get<Sale>(`/sales/${params.id}`)
      .then(setSale)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Vente introuvable.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleCancel() {
    if (!confirm('Annuler cette vente ? Le stock des produits sera remis à jour.')) return;
    setCancelling(true);
    try {
      await api.post(`/sales/${params.id}/cancel`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Annulation impossible.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'CAISSIER']}>
      <div className="mx-auto max-w-2xl px-8 py-8">
        <div className="no-print mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/ventes')}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'historique
          </button>
          {sale && sale.status === 'COMPLETED' && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimer le reçu
              </Button>
              {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                <Button variant="danger" onClick={handleCancel} loading={cancelling}>
                  <Ban className="h-4 w-4" />
                  Annuler la vente
                </Button>
              )}
            </div>
          )}
        </div>

        {isNew && sale?.status === 'COMPLETED' && (
          <div className="no-print mb-6 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Vente encaissée avec succès.
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !sale && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {sale && (
          <div className="print-area">
            {sale.status === 'CANCELLED' && (
              <div className="no-print mb-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Cette vente a été annulée. Le stock des articles a été remis à jour.
              </div>
            )}
            <Card className="p-6 font-mono text-sm">
              <div className="mb-4 text-center">
                <p className="text-base font-semibold">{user?.tenantName}</p>
                <p className="text-xs text-zinc-500">Reçu de vente</p>
                <p className="text-xs text-zinc-500">
                  {new Date(sale.createdAt).toLocaleString('fr-FR')}
                </p>
                <p className="text-xs text-zinc-500">Vendu par {sale.user.name}</p>
                {sale.status === 'CANCELLED' && (
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-500">Annulée</p>
                )}
              </div>

              <div className="border-t border-dashed border-zinc-300 py-3 dark:border-zinc-700">
                {sale.items.map((item) => (
                  <div key={item.id} className="mb-1.5 flex justify-between gap-2">
                    <span className="flex-1">
                      {item.quantity} × {item.product.name}
                    </span>
                    <span>{formatXOF(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-t border-dashed border-zinc-300 py-3 dark:border-zinc-700">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span>{formatXOF(sale.subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Remise</span>
                    <span>-{formatXOF(sale.discount)}</span>
                  </div>
                )}
                {sale.tvaAmount > 0 && (
                  <div className="flex justify-between">
                    <span>TVA</span>
                    <span>{formatXOF(sale.tvaAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatXOF(sale.total)}</span>
                </div>
              </div>

              <div className="space-y-1 border-t border-dashed border-zinc-300 py-3 dark:border-zinc-700">
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>
                      {PAYMENT_METHOD_LABELS[p.method]}
                      {p.reference ? ` (${p.reference})` : ''}
                    </span>
                    <span>{formatXOF(p.amount)}</span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-center text-xs text-zinc-500">Merci de votre visite !</p>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
