'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users2,
  BarChart3,
  Settings,
  Moon,
  Sun,
  LogOut,
  Receipt,
  Boxes,
  Truck,
  ClipboardList,
  Wallet,
  Landmark,
  Bell,
  Store as StoreIcon,
  ChevronsUpDown,
  Check,
  CreditCard,
  ShieldCheck,
  Code2,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/lib/use-theme';
import { Role } from '@/lib/types';
import { NotificationBell } from './notification-bell';
import { OfflineIndicator } from './offline-indicator';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  CAISSIER: 'Caissier',
  MAGASINIER: 'Magasinier',
};

const ALL_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CAISSIER', 'MAGASINIER'];

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
  { label: 'Caisse', href: '/caisse', icon: ShoppingCart, roles: ['ADMIN', 'MANAGER', 'CAISSIER'] },
  { label: 'Ventes', href: '/ventes', icon: Receipt, roles: ['ADMIN', 'MANAGER', 'CAISSIER'] },
  { label: 'Produits', href: '/produits', icon: Package, roles: ALL_ROLES },
  { label: 'Stock', href: '/stock', icon: Boxes, roles: ['ADMIN', 'MANAGER', 'MAGASINIER'] },
  { label: 'Achats', href: '/achats', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'MAGASINIER'] },
  { label: 'Fournisseurs', href: '/fournisseurs', icon: Truck, roles: ['ADMIN', 'MANAGER', 'MAGASINIER'] },
  { label: 'Clients', href: '/clients', icon: Users2, roles: ['ADMIN', 'MANAGER', 'CAISSIER'] },
  { label: 'Rapports', href: '/rapports', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['ADMIN', 'MANAGER'] },
  { label: 'Dépenses', href: '/depenses', icon: Wallet, roles: ['ADMIN'] },
  { label: 'Comptabilité', href: '/comptabilite', icon: Landmark, roles: ['ADMIN'] },
];

const SETTINGS_ITEMS: NavItem[] = [
  { label: 'Boutique', href: '/parametres', icon: Settings, roles: ['ADMIN'] },
  { label: 'Boutiques', href: '/parametres/boutiques', icon: StoreIcon, roles: ['ADMIN'] },
  { label: 'Abonnement', href: '/parametres/abonnement', icon: CreditCard, roles: ['ADMIN'] },
  { label: 'Employés', href: '/parametres/employes', icon: Users2, roles: ['ADMIN', 'MANAGER'] },
  { label: 'Sécurité', href: '/parametres/securite', icon: ShieldCheck, roles: ALL_ROLES },
  { label: "Journal d'audit", href: '/parametres/journal-audit', icon: ClipboardList, roles: ['ADMIN'] },
  { label: 'Développeurs', href: '/parametres/developpeurs', icon: Code2, roles: ['ADMIN'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, stores, activeStoreId, activeStoreName, setActiveStore } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);

  // Referme automatiquement le tiroir après un changement de page (sans effet sur desktop,
  // où le tiroir reste visible en permanence quel que soit cet état).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const role = user?.role as Role | undefined;
  const visibleNavItems = NAV_ITEMS.filter((item) => !role || item.roles.includes(role));
  const visibleSettingsItems = SETTINGS_ITEMS.filter((item) => role && item.roles.includes(role));

  return (
    <>
      {/* Fond semi-transparent, mobile uniquement : referme le tiroir au clic à côté. */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border-light bg-surface-light transition-transform duration-200 dark:border-border-dark dark:bg-surface-dark md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-border-light px-5 py-4 dark:border-border-dark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="BoutikPro" className="h-7 w-7 shrink-0 rounded-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {user?.tenantName ?? 'Ma boutique'}
            </p>
          </div>
          {(role === 'ADMIN' || role === 'MANAGER') && <NotificationBell />}
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      {stores.length > 1 && (
        <div className="relative border-b border-border-light px-3 py-2.5 dark:border-border-dark">
          <button
            onClick={() => setStoreMenuOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <StoreIcon className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 dark:text-zinc-200">
              {activeStoreName ?? 'Choisir une boutique'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          </button>

          {storeMenuOpen && (
            <div className="absolute left-3 right-3 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border-light bg-surface-light shadow-lg dark:border-border-dark dark:bg-surface-dark">
              {role === 'ADMIN' && (
                <button
                  onClick={() => {
                    setStoreMenuOpen(false);
                    if (activeStoreId !== 'ALL') setActiveStore('ALL');
                  }}
                  className="flex w-full items-center justify-between border-b border-border-light px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-border-dark dark:hover:bg-zinc-900"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">Toutes les boutiques</span>
                  {activeStoreId === 'ALL' && <Check className="h-3.5 w-3.5 text-brand-600" />}
                </button>
              )}
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => {
                    setStoreMenuOpen(false);
                    if (store.id !== activeStoreId) setActiveStore(store.id);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">{store.name}</span>
                  {store.id === activeStoreId && <Check className="h-3.5 w-3.5 text-brand-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-3 pt-2">
        <OfflineIndicator />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visibleNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/10 text-brand-700 dark:bg-brand-600/20 dark:text-brand-500'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {visibleSettingsItems.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
              Paramètres
            </p>
            {visibleSettingsItems.map((item) => {
              const isActive =
                item.href === '/parametres' ? pathname === '/parametres' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/10 text-brand-700 dark:bg-brand-600/20 dark:text-brand-500'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-border-light px-3 py-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.name}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">
              {role ? ROLE_LABELS[role] : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={toggleTheme}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === 'dark' ? 'Clair' : 'Sombre'}
          </button>
          <button
            onClick={() => logout()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
