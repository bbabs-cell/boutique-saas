'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Store as StoreIcon, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Card } from '@/components/ui/card';

export default function SelectionBoutiquePage() {
  const { user, loading, stores, activeStoreId, setActiveStore, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (!loading && stores.length === 1) {
      // Une seule boutique : pas besoin de sélecteur, on file directement.
      setActiveStore(stores[0].id);
    } else if (!loading && activeStoreId) {
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, stores, activeStoreId]);

  if (loading || !user || stores.length <= 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-light dark:bg-canvas-dark">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas-light px-4 dark:bg-canvas-dark">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <StoreIcon className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Choisir une boutique</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            {user.tenantName} — vous avez accès à plusieurs boutiques.
          </p>
        </div>

        <div className="space-y-2">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => setActiveStore(store.id)}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand-500">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <StoreIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {store.name}
                  </p>
                  {store.address && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">{store.address}</p>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <button
          onClick={() => logout()}
          className="mx-auto mt-6 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <LogOut className="h-3.5 w-3.5" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
