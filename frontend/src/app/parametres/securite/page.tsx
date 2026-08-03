'use client';

import { FormEvent, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function SecuritePage() {
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState<'idle' | 'scanning'>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [password, setPassword] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);

  async function handleStartSetup() {
    setSetupError(null);
    setStarting(true);
    try {
      const result = await api.post<{ secret: string; qrCodeDataUrl: string }>('/auth/2fa/setup');
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
      setStep('scanning');
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : "Impossible de démarrer l'activation.");
    } finally {
      setStarting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setSetupError(null);
    setVerifying(true);
    try {
      await api.post('/auth/2fa/verify', { code });
      setStep('idle');
      setCode('');
      setQrCodeDataUrl(null);
      await refreshUser();
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'Code invalide.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisabling(true);
    try {
      await api.post('/auth/2fa/disable', { password });
      setPassword('');
      setShowDisableForm(false);
      await refreshUser();
    } catch (err) {
      setDisableError(err instanceof ApiError ? err.message : 'Mot de passe incorrect.');
    } finally {
      setDisabling(false);
    }
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Sécurité</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Authentification à deux facteurs (2FA) pour votre compte.
        </p>

        <Card className="p-6">
          {user.twoFactorEnabled ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">2FA activé</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">
                    Un code est demandé à chaque connexion.
                  </p>
                </div>
              </div>

              {!showDisableForm ? (
                <Button variant="danger" onClick={() => setShowDisableForm(true)}>
                  <ShieldOff className="h-4 w-4" />
                  Désactiver le 2FA
                </Button>
              ) : (
                <form onSubmit={handleDisable} className="space-y-3">
                  <div>
                    <Label htmlFor="password">Confirmez avec votre mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {disableError && <p className="text-sm text-red-500">{disableError}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" loading={disabling}>
                      Confirmer la désactivation
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowDisableForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : step === 'idle' ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <ShieldOff className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">2FA désactivé</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">
                    Ajoutez une étape de vérification à la connexion.
                  </p>
                </div>
              </div>
              {setupError && <p className="mb-3 text-sm text-red-500">{setupError}</p>}
              <Button onClick={handleStartSetup} loading={starting}>
                <ShieldCheck className="h-4 w-4" />
                Activer le 2FA
              </Button>
            </>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Scannez ce QR code avec une application comme Google Authenticator ou Authy, puis
                entrez le code à 6 chiffres affiché.
              </p>
              {qrCodeDataUrl && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeDataUrl} alt="QR code 2FA" className="h-48 w-48 rounded-lg border border-border-light dark:border-border-dark" />
                </div>
              )}
              {secret && (
                <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
                  Ou saisissez manuellement : <span className="font-mono">{secret}</span>
                </p>
              )}
              <div>
                <Label htmlFor="verifyCode">Code de vérification</Label>
                <Input
                  id="verifyCode"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest"
                />
              </div>
              {setupError && <p className="text-sm text-red-500">{setupError}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={verifying}>
                  Confirmer l'activation
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep('idle');
                    setQrCodeDataUrl(null);
                    setCode('');
                  }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
