'use client';

import Link from 'next/link';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/lib/use-online-status';

export function OfflineIndicator() {
  const { isOnline, pendingCount, syncing } = useOnlineStatus();

  if (isOnline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 dark:text-zinc-600">
        <Wifi className="h-3.5 w-3.5 text-green-600" />
        En ligne
      </div>
    );
  }

  return (
    <Link
      href="/caisse/synchronisation"
      className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
    >
      {syncing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isOnline ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      <span>
        {!isOnline && 'Hors-ligne'}
        {isOnline && syncing && 'Synchronisation…'}
        {isOnline && !syncing && pendingCount > 0 && 'À synchroniser'}
      </span>
      {pendingCount > 0 && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
          {pendingCount}
        </span>
      )}
    </Link>
  );
}
