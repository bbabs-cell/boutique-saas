'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { AuditLog, Employee, PaginatedAuditLogs } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

export default function JournalAuditPage() {
  const [data, setData] = useState<PaginatedAuditLogs | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      params.set('page', String(page));
      params.set('pageSize', '25');
      const result = await api.get<PaginatedAuditLogs>(`/audit-logs?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le journal.');
    } finally {
      setLoading(false);
    }
  }, [userId, entityType, action, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [userId, entityType, action]);

  useEffect(() => {
    api.get<Employee[]>('/users').then(setEmployees).catch(() => {});
  }, []);

  function formatMetadata(log: AuditLog): string {
    if (!log.metadata || Object.keys(log.metadata).length === 0) return '—';
    return Object.entries(log.metadata)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(', ');
  }

  return (
    <AppShell allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <ClipboardList className="h-5 w-5" />
            Journal d'audit
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            {data ? `${data.total} entrée${data.total > 1 ? 's' : ''}` : ''} — actions journalisées depuis
            l'activation du Sprint 10, pas l'historique antérieur.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-48">
            <option value="">Tous les employés</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Type d'entité (ex : products)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-52"
          />
          <Input
            placeholder="Action (ex : products.update)"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-56"
          />
        </div>

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && loading && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">Chargement…</p>
          )}
          {!error && !loading && data && data.items.length === 0 && (
            <p className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-500">
              Aucune entrée pour ces filtres.
            </p>
          )}
          {!error && !loading && data && data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Employé</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entité</th>
                  <th className="px-4 py-3 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id} className="border-b border-border-light last:border-0 dark:border-border-dark">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-500">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{log.user.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                      {log.entityType} · {log.entityId.slice(0, 8)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-500 dark:text-zinc-500">
                      {formatMetadata(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-500">
            <span>
              Page {data.page} sur {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
