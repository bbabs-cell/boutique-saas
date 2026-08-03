'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPendingCount, syncPendingSales } from './offline-db';

interface OnlineStatus {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSyncError: string | null;
  refreshPendingCount: () => void;
  triggerSync: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  // navigator.onLine vaut true par défaut côté serveur (rendu initial) ; corrigé au montage.
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(() => {
    getPendingCount()
      .then(setPendingCount)
      .catch(() => {});
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setLastSyncError(null);
    try {
      await syncPendingSales();
    } catch (err) {
      setLastSyncError(err instanceof Error ? err.message : 'La synchronisation a échoué.');
    } finally {
      setSyncing(false);
      refreshPendingCount();
    }
  }, [syncing, refreshPendingCount]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshPendingCount();

    function handleOnline() {
      setIsOnline(true);
      // Retour de connexion : on tente une synchro automatiquement, sans action de l'utilisateur.
      triggerSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, pendingCount, syncing, lastSyncError, refreshPendingCount, triggerSync };
}
