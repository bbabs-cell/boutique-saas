'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, PackageX, AlertTriangle, Wallet, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Notification, NotificationType, PaginatedNotifications } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, Card } from '@/components/ui/card';

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  LOW_STOCK: AlertTriangle,
  OUT_OF_STOCK: PackageX,
  PAYMENT_RECEIVED: Wallet,
  SUBSCRIPTION_EXPIRING: CalendarClock,
};

const TYPE_LABELS: Record<NotificationType, string> = {
  LOW_STOCK: 'Stock faible',
  OUT_OF_STOCK: 'Rupture de stock',
  PAYMENT_RECEIVED: 'Paiement reçu',
  SUBSCRIPTION_EXPIRING: 'Abonnement',
};

export default function NotificationsPage() {
  const [data, setData] = useState<PaginatedNotifications | null>(null);
  const [readFilter, setReadFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (readFilter) params.set('read', readFilter);
      params.set('page', String(page));
      params.set('pageSize', '20');
      const result = await api.get<PaginatedNotifications>(`/notifications?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les notifications.');
    } finally {
      setLoading(false);
    }
  }, [readFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [readFilter]);

  async function handleMarkRead(notification: Notification) {
    if (notification.read) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action impossible.');
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action impossible.');
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {data ? `${data.total} notification${data.total > 1 ? 's' : ''}` : ''}
              {data && data.unreadCount > 0 ? ` — ${data.unreadCount} non lue${data.unreadCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          {data && data.unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        <div className="mb-4">
          <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value)} className="w-48">
            <option value="">Toutes</option>
            <option value="false">Non lues</option>
            <option value="true">Lues</option>
          </Select>
        </div>

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && loading && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          )}
          {!error && !loading && data && data.items.length === 0 && (
            <p className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-500">
              Aucune notification.
            </p>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <ul>
              {data.items.map((n) => {
                const Icon = TYPE_ICONS[n.type];
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 border-b border-border-light px-4 py-3.5 text-sm last:border-0 dark:border-border-dark ${
                      !n.read ? 'bg-brand-600/5' : ''
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-zinc-700 dark:text-zinc-300 ${!n.read ? 'font-medium text-zinc-900 dark:text-zinc-100' : ''}`}
                      >
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                        {TYPE_LABELS[n.type]} — {new Date(n.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => handleMarkRead(n)}
                        className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                      >
                        Marquer comme lu
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-500">
            <span>
              Page {data.page} sur {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
