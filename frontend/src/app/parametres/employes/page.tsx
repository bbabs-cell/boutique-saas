'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { Employee, Role } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  CAISSIER: 'Caissier',
  MAGASINIER: 'Magasinier',
};

export default function EmployesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CAISSIER');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Un MANAGER ne peut pas créer de compte ADMIN.
  const assignableRoles: Role[] =
    user?.role === 'ADMIN' ? ['ADMIN', 'MANAGER', 'CAISSIER', 'MAGASINIER'] : ['MANAGER', 'CAISSIER', 'MAGASINIER'];

  async function load() {
    try {
      const result = await api.get<Employee[]>('/users');
      setEmployees(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les employés.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api.post('/users', { name, email, password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('CAISSIER');
      setShowForm(false);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setFormError('Création impossible.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(employee: Employee) {
    setTogglingId(employee.id);
    try {
      await api.patch(`/users/${employee.id}`, { active: !employee.active });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Employés</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Gérez les accès de votre équipe (rôles ADMIN, Manager, Caissier, Magasinier).
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Ajouter un employé
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={fieldErrors.name?.[0]}
                />
              </div>
              <div>
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErrors.email?.[0]}
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe temporaire</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  error={fieldErrors.password?.[0]}
                />
              </div>
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={submitting}>
                  Créer le compte
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="overflow-hidden">
          {error && <p className="p-4 text-sm text-red-500">{error}</p>}
          {!error && !employees && (
            <div className="flex items-center gap-2 p-6 text-sm text-zinc-500 dark:text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          )}
          {!error && employees && employees.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
              Aucun employé pour le moment.
            </p>
          )}
          {!error && employees && employees.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-border-dark dark:bg-zinc-900 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-border-light last:border-0 dark:border-border-dark"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{emp.name}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">{emp.email}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500">
                      {ROLE_LABELS[emp.role as Role]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          emp.active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'
                        }`}
                      >
                        {emp.active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {emp.role !== 'ADMIN' && (
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          loading={togglingId === emp.id}
                          onClick={() => toggleActive(emp)}
                        >
                          {emp.active ? 'Désactiver' : 'Activer'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
