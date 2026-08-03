'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthResponse, AuthUser, Store } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  stores: Store[];
  activeStoreId: string | 'ALL' | null;
  activeStoreName: string | null;
  login: (email: string, password: string, code?: string) => Promise<{ requiresTwoFactor: boolean }>;
  register: (data: { shopName: string; adminName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setActiveStore: (storeId: string | 'ALL') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type MeResponse = Omit<
  AuthUser,
  'tenantName' | 'tvaEnabled' | 'tvaRate' | 'logoUrl' | 'language'
> & {
  tenant: {
    id: string;
    name: string;
    tvaEnabled: boolean;
    tvaRate: number;
    logoUrl: string | null;
    language: string;
  };
  stores: Store[];
};

function mapMeResponse(me: MeResponse): AuthUser {
  return {
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.role,
    theme: me.theme,
    tenantId: me.tenantId,
    tenantName: me.tenant.name,
    tvaEnabled: me.tenant.tvaEnabled,
    tvaRate: me.tenant.tvaRate,
    logoUrl: me.tenant.logoUrl,
    language: me.tenant.language,
    twoFactorEnabled: me.twoFactorEnabled,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreIdState] = useState<string | 'ALL' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<MeResponse>('/auth/me')
      .then((me) => {
        setUser(mapMeResponse(me));
        setStores(me.stores);
        applyStoreSelection(me.stores);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Valide/complète la boutique active au chargement : conserve la sélection si toujours
   *  valide, l'auto-sélectionne s'il n'y en a qu'une, sinon laisse activeStoreId à null
   *  (AppShell redirigera vers le sélecteur). */
  function applyStoreSelection(availableStores: Store[]) {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('activeStoreId') : null;
    if (stored === 'ALL') {
      setActiveStoreIdState('ALL');
      return;
    }
    if (stored && availableStores.some((s) => s.id === stored)) {
      setActiveStoreIdState(stored);
      return;
    }
    if (availableStores.length === 1) {
      localStorage.setItem('activeStoreId', availableStores[0].id);
      setActiveStoreIdState(availableStores[0].id);
      return;
    }
    localStorage.removeItem('activeStoreId');
    setActiveStoreIdState(null);
  }

  async function refreshUser() {
    try {
      const me = await api.get<MeResponse>('/auth/me');
      setUser(mapMeResponse(me));
      setStores(me.stores);
    } catch {
      // silencieux : l'utilisateur reste sur ses dernières données connues
    }
  }

  function persistSession(res: AuthResponse) {
    localStorage.setItem('accessToken', res.accessToken);
    setUser(res.user);
    setStores(res.stores);
    if (res.defaultStoreId) {
      localStorage.setItem('activeStoreId', res.defaultStoreId);
      setActiveStoreIdState(res.defaultStoreId);
    } else {
      localStorage.removeItem('activeStoreId');
      setActiveStoreIdState(null);
    }
  }

  async function login(email: string, password: string, code?: string) {
    const res = await api.post<AuthResponse | { requiresTwoFactor: true }>('/auth/login', {
      email,
      password,
      code,
    });
    if ('requiresTwoFactor' in res) {
      return { requiresTwoFactor: true };
    }
    persistSession(res);
    router.push(res.defaultStoreId ? '/dashboard' : '/selection-boutique');
    return { requiresTwoFactor: false };
  }

  async function register(data: { shopName: string; adminName: string; email: string; password: string }) {
    const res = await api.post<AuthResponse>('/auth/register', data);
    persistSession(res);
    router.push(res.defaultStoreId ? '/dashboard' : '/selection-boutique');
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('activeStoreId');
      setUser(null);
      setStores([]);
      setActiveStoreIdState(null);
      router.push('/login');
    }
  }

  function setActiveStore(storeId: string | 'ALL') {
    localStorage.setItem('activeStoreId', storeId);
    setActiveStoreIdState(storeId);
    // Rechargement complet : garantit que toutes les données déjà chargées dans l'app
    // (produits, stock, ventes…) sont refaites avec la nouvelle boutique active.
    // /produits est accessible à tous les rôles, contrairement à /dashboard.
    window.location.href = '/produits';
  }

  const activeStoreName =
    activeStoreId === 'ALL' ? 'Toutes les boutiques' : stores.find((s) => s.id === activeStoreId)?.name ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        stores,
        activeStoreId,
        activeStoreName,
        login,
        register,
        logout,
        refreshUser,
        setActiveStore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  return ctx;
}
