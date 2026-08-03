'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Copy, Trash2, ExternalLink, Key, Webhook as WebhookIcon, Check } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import {
  ApiKey,
  ApiKeyWithPlainKey,
  Webhook,
  WebhookEventName,
  WebhookWithSecret,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const WEBHOOK_EVENTS: { value: WebhookEventName; label: string }[] = [
  { value: 'sale.created', label: 'Vente créée' },
  { value: 'stock.low', label: 'Stock faible' },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export default function DeveloppeursPage() {
  // Clés API
  const [apiKeys, setApiKeys] = useState<ApiKey[] | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<ApiKeyWithPlainKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhooks
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventName[]>([]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<WebhookWithSecret | null>(null);

  async function loadKeys() {
    try {
      setApiKeys(await api.get<ApiKey[]>('/settings/api-keys'));
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : 'Impossible de charger les clés API.');
    }
  }

  async function loadWebhooks() {
    try {
      setWebhooks(await api.get<Webhook[]>('/settings/webhooks'));
    } catch (err) {
      setWebhookError(err instanceof ApiError ? err.message : 'Impossible de charger les webhooks.');
    }
  }

  useEffect(() => {
    loadKeys();
    loadWebhooks();
  }, []);

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault();
    setKeyError(null);
    setCreatingKey(true);
    try {
      const result = await api.post<ApiKeyWithPlainKey>('/settings/api-keys', { name: newKeyName });
      setRevealedKey(result);
      setNewKeyName('');
      setShowKeyForm(false);
      loadKeys();
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : 'Création impossible.');
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeKey(id: string, name: string) {
    if (!confirm(`Révoquer la clé « ${name} » ? Toute intégration l'utilisant cessera de fonctionner.`)) return;
    try {
      await api.delete(`/settings/api-keys/${id}`);
      loadKeys();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Révocation impossible.');
    }
  }

  function toggleEvent(event: WebhookEventName) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleCreateWebhook(e: FormEvent) {
    e.preventDefault();
    setWebhookError(null);
    if (selectedEvents.length === 0) {
      setWebhookError('Sélectionnez au moins un événement.');
      return;
    }
    setCreatingWebhook(true);
    try {
      const result = await api.post<WebhookWithSecret>('/settings/webhooks', {
        url: webhookUrl,
        events: selectedEvents,
      });
      setRevealedSecret(result);
      setWebhookUrl('');
      setSelectedEvents([]);
      setShowWebhookForm(false);
      loadWebhooks();
    } catch (err) {
      setWebhookError(err instanceof ApiError ? err.message : 'Création impossible.');
    } finally {
      setCreatingWebhook(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm('Supprimer ce webhook ?')) return;
    try {
      await api.delete(`/settings/webhooks/${id}`);
      loadWebhooks();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Développeurs</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Clés API et webhooks pour intégrer des outils tiers en lecture seule.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
            >
              Documentation REST
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={`${API_BASE_URL}/graphql`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
            >
              Explorateur GraphQL
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <p className="mb-6 -mt-4 text-xs text-zinc-400 dark:text-zinc-600">
          L'explorateur GraphQL s'ouvre librement, mais chaque requête exécutée exige la même clé
          API que le REST (en-tête <code className="font-mono">X-API-Key</code>).
        </p>

        {revealedKey && (
          <Card className="mb-6 border-amber-400 p-5">
            <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              Copiez cette clé maintenant — elle ne sera plus jamais affichée.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
                {revealedKey.plainKey}
              </code>
              <Button variant="secondary" onClick={() => copyToClipboard(revealedKey.plainKey)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <button
              onClick={() => setRevealedKey(null)}
              className="mt-3 text-xs font-medium text-zinc-500 hover:underline"
            >
              J'ai copié la clé, fermer
            </button>
          </Card>
        )}

        {revealedSecret && (
          <Card className="mb-6 border-amber-400 p-5">
            <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              Secret du webhook — copiez-le maintenant pour vérifier la signature HMAC des appels reçus.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
                {revealedSecret.secret}
              </code>
              <Button variant="secondary" onClick={() => copyToClipboard(revealedSecret.secret)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <button
              onClick={() => setRevealedSecret(null)}
              className="mt-3 text-xs font-medium text-zinc-500 hover:underline"
            >
              J'ai copié le secret, fermer
            </button>
          </Card>
        )}

        {/* Clés API */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <Key className="h-4 w-4" />
              Clés API
            </h2>
            <Button variant="secondary" onClick={() => setShowKeyForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              Générer une clé
            </Button>
          </div>

          {showKeyForm && (
            <Card className="mb-3 p-4">
              <form onSubmit={handleCreateKey} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="keyName">Nom (ex : Intégration comptabilité)</Label>
                  <Input id="keyName" required value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
                </div>
                <Button type="submit" loading={creatingKey}>
                  Générer
                </Button>
              </form>
            </Card>
          )}
          {keyError && <p className="mb-2 text-sm text-red-500">{keyError}</p>}

          <Card className="overflow-hidden">
            {!apiKeys ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
            ) : apiKeys.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-500">Aucune clé API.</p>
            ) : (
              <ul>
                {apiKeys.map((key) => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between border-b border-border-light px-4 py-3 text-sm last:border-0 dark:border-border-dark"
                  >
                    <div>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{key.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Créée le {new Date(key.createdAt).toLocaleDateString('fr-FR')}
                        {key.lastUsedAt && ` — dernière utilisation le ${new Date(key.lastUsedAt).toLocaleDateString('fr-FR')}`}
                        {key.revokedAt && ' — révoquée'}
                      </p>
                    </div>
                    {!key.revokedAt && (
                      <button
                        onClick={() => handleRevokeKey(key.id, key.name)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Webhooks */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <WebhookIcon className="h-4 w-4" />
              Webhooks
            </h2>
            <Button variant="secondary" onClick={() => setShowWebhookForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              Ajouter un webhook
            </Button>
          </div>

          {showWebhookForm && (
            <Card className="mb-3 p-4">
              <form onSubmit={handleCreateWebhook} className="space-y-3">
                <div>
                  <Label htmlFor="webhookUrl">URL de destination</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://exemple.com/webhooks/boutique"
                  />
                </div>
                <div>
                  <Label>Événements</Label>
                  <div className="flex gap-4">
                    {WEBHOOK_EVENTS.map((evt) => (
                      <label key={evt.value} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(evt.value)}
                          onChange={() => toggleEvent(evt.value)}
                          className="h-4 w-4 rounded border-border-light text-brand-600 focus:ring-brand-500 dark:border-border-dark"
                        />
                        {evt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" loading={creatingWebhook}>
                  Créer le webhook
                </Button>
              </form>
            </Card>
          )}
          {webhookError && <p className="mb-2 text-sm text-red-500">{webhookError}</p>}

          <Card className="overflow-hidden">
            {!webhooks ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
            ) : webhooks.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-500">Aucun webhook configuré.</p>
            ) : (
              <ul>
                {webhooks.map((wh) => (
                  <li
                    key={wh.id}
                    className="flex items-center justify-between border-b border-border-light px-4 py-3 text-sm last:border-0 dark:border-border-dark"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">{wh.url}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">{wh.events.join(', ')}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
