'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Store, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password, needsCode ? code : undefined);
      if (result.requiresTwoFactor) {
        setNeedsCode(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-light px-4 dark:bg-canvas-dark">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            {needsCode ? <ShieldCheck className="h-5 w-5" /> : <Store className="h-5 w-5" />}
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {needsCode ? 'Vérification en deux étapes' : 'Connexion'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            {needsCode
              ? "Entrez le code affiché dans votre application d'authentification."
              : 'Accédez à la gestion de votre boutique.'}
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!needsCode ? (
              <>
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
                  />
                </div>
                <div>
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="code">Code de vérification</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest"
                />
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              {needsCode ? 'Vérifier' : 'Se connecter'}
            </Button>
            {needsCode && (
              <button
                type="button"
                onClick={() => {
                  setNeedsCode(false);
                  setCode('');
                  setError(null);
                }}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Revenir à la connexion
              </button>
            )}
          </form>
        </Card>

        {!needsCode && (
          <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-500">
            Pas encore de boutique ?{' '}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Créer un compte
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
