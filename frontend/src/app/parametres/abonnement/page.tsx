'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Receipt } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Invoice, PlanTier, Subscription } from '@/lib/types';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const PLAN_LABELS: Record<PlanTier, string> = {
  FREE: 'Gratuit',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PREMIUM: 'Premium',
};

const PLAN_PRICES: Record<PlanTier, number> = {
  FREE: 0,
  STARTER: 15000,
  BUSINESS: 35000,
  PREMIUM: 60000,
};

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  FREE: ['1 boutique', '50 produits max'],
  STARTER: ['3 boutiques', 'Produits illimités', 'Rôles Manager / Magasinier'],
  BUSINESS: ['Boutiques illimitées', 'Produits illimités', 'Rôles fins', 'Comptabilité'],
  PREMIUM: ['Boutiques illimitées', 'Produits illimités', 'Rôles fins', 'Comptabilité', 'API publique'],
};

const PLAN_ORDER: PlanTier[] = ['FREE', 'STARTER', 'BUSINESS', 'PREMIUM'];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  EXPIRED: 'Expiré',
  CANCELLED: 'Annulé',
};

export default function AbonnementPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  async function load() {
    try {
      const [sub, inv] = await Promise.all([
        api.get<Subscription>('/subscription'),
        api.get<Invoice[]>('/subscription/invoices'),
      ]);
      setSubscription(sub);
      setInvoices(inv);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'abonnement.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpgrade(plan: PlanTier) {
    if (!confirm(`Passer au plan ${PLAN_LABELS[plan]} ?`)) return;
    setUpgradeError(null);
    setUpgrading(plan);
    try {
      await api.post('/subscription/upgrade', { plan });
      load();
    } catch (err) {
      setUpgradeError(err instanceof ApiError ? err.message : 'Le changement de plan a échoué.');
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-4xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Abonnement</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Plan actuel, comparatif des offres et historique de facturation.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !subscription && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {subscription && (
          <>
            <Card className="mb-6 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-zinc-500 dark:text-zinc-500">Plan actuel</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {PLAN_LABELS[subscription.plan]}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      subscription.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {STATUS_LABELS[subscription.status]}
                  </span>
                  {subscription.expiresAt && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      Expire le {new Date(subscription.expiresAt).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {upgradeError && <p className="mb-4 text-sm text-red-500">{upgradeError}</p>}

            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLAN_ORDER.map((plan) => {
                const isCurrent = plan === subscription.plan;
                return (
                  <Card
                    key={plan}
                    className={`flex flex-col p-5 ${isCurrent ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}
                  >
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{PLAN_LABELS[plan]}</p>
                    <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {PLAN_PRICES[plan] === 0 ? 'Gratuit' : formatXOF(PLAN_PRICES[plan])}
                      {PLAN_PRICES[plan] > 0 && (
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-500"> / mois</span>
                      )}
                    </p>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {PLAN_FEATURES[plan].map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-4 w-full"
                      variant={isCurrent ? 'secondary' : 'primary'}
                      disabled={isCurrent}
                      loading={upgrading === plan}
                      onClick={() => handleUpgrade(plan)}
                    >
                      {isCurrent ? 'Plan actuel' : 'Choisir'}
                    </Button>
                  </Card>
                );
              })}
            </div>

            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <Receipt className="h-4 w-4" />
              Historique de facturation
            </h2>
            <Card className="overflow-hidden">
              {invoices.length === 0 ? (
                <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
                  Aucune facture pour le moment.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Période</th>
                      <th className="px-4 py-3 font-medium">Montant</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border-light last:border-0 dark:border-border-dark">
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                          {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{PLAN_LABELS[inv.plan]}</td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                          {new Date(inv.periodStart).toLocaleDateString('fr-FR')} –{' '}
                          {new Date(inv.periodEnd).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {formatXOF(inv.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {inv.paidAt ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Payée{inv.method ? ` (${PAYMENT_METHOD_LABELS[inv.method]})` : ''}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              En attente de paiement
                            </span>
                          )}
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
