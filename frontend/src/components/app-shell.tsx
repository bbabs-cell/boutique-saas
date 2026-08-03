'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Menu } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre visible uniquement sur mobile : le tiroir est fermé par défaut pour laisser
            toute la place au contenu, ce bouton permet de le rouvrir. */}
        <div className="no-print flex items-center gap-2 border-b border-border-light bg-surface-light px-4 py-3 dark:border-border-dark dark:bg-surface-dark md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="BoutikPro" className="h-6 w-6 rounded object-cover" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">BoutikPro</span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
