'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, PackageX, AlertTriangle, Wallet, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { Notification, NotificationType, PaginatedNotifications } from '@/lib/types';

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  LOW_STOCK: AlertTriangle,
  OUT_OF_STOCK: PackageX,
  PAYMENT_RECEIVED: Wallet,
  SUBSCRIPTION_EXPIRING: CalendarClock,
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PaginatedNotifications | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const result = await api.get<PaginatedNotifications>('/notifications?pageSize=8');
      setData(result);
    } catch {
      // silencieux : la cloche reste discrète en cas d'échec
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // rafraîchit le badge toutes les minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleMarkRead(notification: Notification) {
    if (notification.read) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      load();
    } catch {
      // silencieux
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      load();
    } catch {
      // silencieux
    }
  }

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-80 overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-lg dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-2.5 dark:border-border-dark">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!data || data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
                Aucune notification.
              </p>
            ) : (
              data.items.map((n) => {
                const Icon = TYPE_ICONS[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => handleMarkRead(n)}
                    className={`flex w-full items-start gap-2.5 border-b border-border-light px-4 py-3 text-left text-sm last:border-0 hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900 ${
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
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border-light px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:underline dark:border-border-dark"
          >
            Voir tout l'historique
          </Link>
        </div>
      )}
    </div>
  );
}
