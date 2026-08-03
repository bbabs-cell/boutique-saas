'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Wallet } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { SupplierDetail, PaymentMethod } from '@/lib/types';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const SETTLEMENT_METHODS: PaymentMethod[] = ['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARD'];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ORDERED: 'Commandée',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

export default function FicheFournisseurPage() {
  const params = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .get<SupplierDetail>(`/suppliers/${params.id}`)
      .then(setSupplier)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Fournisseur introuvable.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!amount || Number(amount) <= 0) {
      setFormError('Indiquez un montant valide.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/suppliers/${params.id}/payments`, { amount: Number(amount), method });
      setAmount('');
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Règlement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <Link
          href="/fournisseurs"
          className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          ← Retour aux fournisseurs
        </Link>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !supplier && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {supplier && (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{supplier.name}</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                  {supplier.phone ?? 'Aucun numéro renseigné'}
                </p>
              </div>
              <Button onClick={() => setShowForm((v) => !v)}>
                <Wallet className="h-4 w-4" />
                Enregistrer un règlement
              </Button>
            </div>

            <Card className="mb-6 p-4">
              <p className="text-xs uppercase text-zinc-500 dark:text-zinc-500">Dette actuelle</p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  supplier.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                {formatXOF(supplier.balance)}
              </p>
            </Card>

            {showForm && (
              <Card className="mb-6 p-5">
                <form onSubmit={handlePayment} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="amount">Montant réglé</Label>
                    <Input
                      id="amount"
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="w-40">
                    <Label htmlFor="method">Mode</Label>
                    <Select
                      id="method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    >
                      {SETTLEMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" loading={submitting}>
                    Enregistrer
                  </Button>
                </form>
                {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}
              </Card>
            )}

            <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Historique des règlements
            </h2>
            <Card className="mb-6 overflow-hidden">
              {supplier.payments.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500 dark:text-zinc-500">Aucun règlement enregistré.</p>
              ) : (
                <ul>
                  {supplier.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between border-b border-border-light px-4 py-2.5 text-sm last:border-0 dark:border-border-dark"
                    >
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {new Date(p.createdAt).toLocaleString('fr-FR')} — {PAYMENT_METHOD_LABELS[p.method]}
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {formatXOF(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Historique des commandes
            </h2>
            <Card className="overflow-hidden">
              {supplier.purchaseOrders.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500 dark:text-zinc-500">Aucune commande enregistrée.</p>
              ) : (
                <ul>
                  {supplier.purchaseOrders.map((po) => (
                    <li key={po.id}>
                      <Link
                        href={`/achats/${po.id}`}
                        className="flex items-center justify-between border-b border-border-light px-4 py-2.5 text-sm last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                      >
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {new Date(po.createdAt).toLocaleString('fr-FR')}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">
                          {STATUS_LABELS[po.status]}
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {formatXOF(po.total)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
