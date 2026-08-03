'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function RegisterPage() {
  const { register } = useAuth();
  const [shopName, setShopName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await register({ shopName, adminName, email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError('Inscription impossible.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-light px-4 py-10 dark:bg-canvas-dark">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.png"
            alt="BoutikPro"
            className="mb-3 h-14 w-14 rounded-xl object-cover shadow-sm"
          />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Créer votre boutique</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Fini les cahiers de gestion — passez au numérique.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="shopName">Nom de la boutique</Label>
              <Input
                id="shopName"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex : Épicerie Kayes"
                error={fieldErrors.shopName?.[0]}
              />
            </div>
            <div>
              <Label htmlFor="adminName">Votre nom</Label>
              <Input
                id="adminName"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Ex : Aïcha Traoré"
                error={fieldErrors.adminName?.[0]}
              />
            </div>
            <div>
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@boutique.ml"
                error={fieldErrors.email?.[0]}
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                error={fieldErrors.password?.[0]}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Créer ma boutique
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-500">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
