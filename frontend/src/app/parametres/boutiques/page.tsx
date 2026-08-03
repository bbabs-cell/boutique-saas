'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Users2, X, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Employee, Role, StoreDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  CAISSIER: 'Caissier',
  MAGASINIER: 'Magasinier',
};

export default function BoutiquesPage() {
  const [stores, setStores] = useState<StoreDetail[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [assigningStoreId, setAssigningStoreId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  async function load() {
    try {
      const [storesRes, employeesRes] = await Promise.all([
        api.get<StoreDetail[]>('/stores'),
        api.get<Employee[]>('/users'),
      ]);
      setStores(storesRes);
      setEmployees(employeesRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les boutiques.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/stores', { name, address: address.trim() || null });
      setName('');
      setAddress('');
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(storeId: string) {
    if (!selectedUserId) return;
    try {
      await api.post(`/stores/${storeId}/users`, { userId: selectedUserId });
      setSelectedUserId('');
      setAssigningStoreId(null);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Assignation impossible.');
    }
  }

  async function handleUnassign(storeId: string, userId: string) {
    try {
      await api.delete(`/stores/${storeId}/users/${userId}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Retrait impossible.');
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Boutiques</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Gérez vos points de vente et l'accès de votre équipe à chacun.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Ajouter une boutique
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nom</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Sikasso" />
              </div>
              <div>
                <Label htmlFor="address">Adresse (optionnel)</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={submitting}>
                  Créer la boutique
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !stores && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {!error && stores && (
          <div className="space-y-4">
            {stores.map((store) => (
              <Card key={store.id} className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{store.name}</p>
                    {store.address && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">{store.address}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setAssigningStoreId(assigningStoreId === store.id ? null : store.id)}
                  >
                    <Users2 className="h-3.5 w-3.5" />
                    Assigner un employé
                  </Button>
                </div>

                {assigningStoreId === store.id && (
                  <div className="mb-3 flex gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                    <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="flex-1">
                      <option value="">Sélectionner un employé…</option>
                      {employees
                        .filter((e) => !store.userStores.some((us) => us.userId === e.id))
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({ROLE_LABELS[e.role]})
                          </option>
                        ))}
                    </Select>
                    <Button onClick={() => handleAssign(store.id)}>Assigner</Button>
                  </div>
                )}

                {store.userStores.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">Aucun employé assigné.</p>
                ) : (
                  <ul className="space-y-1">
                    {store.userStores.map((us) => (
                      <li
                        key={us.userId}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {us.user.name}{' '}
                          <span className="text-xs text-zinc-400 dark:text-zinc-600">
                            ({ROLE_LABELS[us.user.role]})
                          </span>
                        </span>
                        <button
                          onClick={() => handleUnassign(store.id, us.userId)}
                          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
