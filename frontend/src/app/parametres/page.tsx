'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { TenantSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const LANGUAGE_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
};

export default function ParametresPage() {
  const { refreshUser } = useAuth();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [tvaEnabled, setTvaEnabled] = useState(false);
  const [tvaRate, setTvaRate] = useState('0');
  const [language, setLanguage] = useState('fr');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    api
      .get<TenantSettings>('/settings')
      .then((s) => {
        setSettings(s);
        setName(s.name);
        setCurrency(s.currency);
        setTvaEnabled(s.tvaEnabled);
        setTvaRate(String(s.tvaRate));
        setLanguage(s.language);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les paramètres.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await api.patch<TenantSettings>('/settings', {
        name,
        currency,
        tvaEnabled,
        tvaRate: Number(tvaRate),
        language,
      });
      setSettings(updated);
      setSaved(true);
      await refreshUser();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "L'enregistrement a échoué.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.postForm<{ logoUrl: string }>('/settings/logo', formData);
      setSettings((prev) => (prev ? { ...prev, logoUrl: result.logoUrl } : prev));
      await refreshUser();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "L'envoi du logo a échoué.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <AppShell adminOnly>
      <div className="mx-auto max-w-2xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Paramètres de la boutique
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Nom, logo, devise, TVA et langue de l'application.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !settings && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {settings && (
          <div className="space-y-6">
            {/* Logo */}
            <Card className="p-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Logo</h2>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border-light bg-zinc-50 dark:border-border-dark dark:bg-zinc-800">
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logoUrl} alt="Logo de la boutique" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-lg font-semibold text-zinc-400">{settings.name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Changer le logo
                  </Button>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">PNG, JPEG, WEBP ou SVG — 2 Mo max</p>
                  {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
                </div>
              </div>
            </Card>

            {/* Formulaire principal */}
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nom de la boutique</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <Label htmlFor="currency">Devise</Label>
                  <Input id="currency" required value={currency} onChange={(e) => setCurrency(e.target.value)} />
                </div>

                <div>
                  <Label htmlFor="language">Langue</Label>
                  <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="rounded-lg border border-border-light p-4 dark:border-border-dark">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={tvaEnabled}
                      onChange={(e) => setTvaEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border-light text-brand-600 focus:ring-brand-500 dark:border-border-dark"
                    />
                    Appliquer la TVA sur les ventes
                  </label>
                  {tvaEnabled && (
                    <div className="mt-3">
                      <Label htmlFor="tvaRate">Taux de TVA (%)</Label>
                      <Input
                        id="tvaRate"
                        type="number"
                        min={0}
                        max={100}
                        value={tvaRate}
                        onChange={(e) => setTvaRate(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                {saveError && <p className="text-sm text-red-500">{saveError}</p>}
                {saved && <p className="text-sm text-green-600 dark:text-green-400">Paramètres enregistrés.</p>}

                <Button type="submit" loading={saving}>
                  Enregistrer les modifications
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
