'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Role } from '@/lib/types';
import { Sidebar } from './sidebar';

// Page de repli sûre : accessible à tous les rôles, utilisée quand un accès est refusé
// pour éviter une boucle de redirection (ex : un CAISSIER visitant /dashboard).
const FALLBACK_ROUTE = '/produits';

interface AppShellProps {
  children: ReactNode;
  /** @deprecated utiliser allowedRoles=['ADMIN'] */
  adminOnly?: boolean;
  allowedRoles?: Role[];
}

export function AppShell({ children, adminOnly = false, allowedRoles }: AppShellProps) {
  const { user, loading, stores, activeStoreId } = useAuth();
  const router = useRouter();

  const effectiveAllowedRoles = allowedRoles ?? (adminOnly ? (['ADMIN'] as Role[]) : null);
  const isAllowed = !effectiveAllowedRoles || (user && effectiveAllowedRoles.includes(user.role as Role));
  // Plusieurs boutiques accessibles mais aucune sélectionnée : impossible d'utiliser l'app.
  const needsStoreSelection = !loading && user && stores.length > 1 && !activeStoreId;

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (needsStoreSelection) {
      router.replace('/selection-boutique');
    } else if (!loading && user && !isAllowed) {
      router.replace(FALLBACK_ROUTE);
    }
  }, [loading, user, isAllowed, needsStoreSelection, router]);

  if (loading || !user || !isAllowed || needsStoreSelection) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-light dark:bg-canvas-dark">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-canvas-light dark:bg-canvas-dark">
      <div className="no-print">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
