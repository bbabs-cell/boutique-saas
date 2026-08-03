'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Supplier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function NouveauFournisseurPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const supplier = await api.post<Supplier>('/suppliers', { name, phone: phone.trim() || null });
      router.push(`/fournisseurs/${supplier.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError('Création impossible.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Ajouter un fournisseur
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Nécessaire pour passer une commande d'achat.
        </p>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Grossiste Bamako"
                error={fieldErrors.name?.[0]}
              />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone (optionnel)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex : 76 00 00 00"
                error={fieldErrors.phone?.[0]}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={loading}>
                Créer le fournisseur
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/fournisseurs')}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
