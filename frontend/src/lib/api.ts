const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[] | undefined>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[] | undefined>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function getActiveStoreId(): string | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem('activeStoreId');
  return value && value !== 'ALL' ? value : null;
}

/** Ajoute storeId à l'URL (GET/DELETE) si une boutique active existe et que l'appelant n'en a pas déjà précisé un. */
function withStoreIdInPath(path: string): string {
  const storeId = getActiveStoreId();
  if (!storeId || path.includes('storeId=')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}storeId=${encodeURIComponent(storeId)}`;
}

/** Ajoute storeId au corps JSON (POST/PATCH) si une boutique active existe et qu'il n'est pas déjà fourni. */
function withStoreIdInBody(data?: unknown): unknown {
  const storeId = getActiveStoreId();
  if (!storeId) return data;
  if (data && typeof data === 'object' && !Array.isArray(data) && !('storeId' in (data as object))) {
    return { ...(data as object), storeId };
  }
  if (!data) {
    return { storeId };
  }
  return data;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      // pas de corps JSON
    }
    throw new ApiError(body.message ?? 'Une erreur est survenue.', res.status, body.errors);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(withStoreIdInPath(path), { method: 'GET' }),
  post: <T>(path: string, data?: unknown) => {
    const body = withStoreIdInBody(data);
    return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  },
  patch: <T>(path: string, data?: unknown) => {
    const body = withStoreIdInBody(data);
    return request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  },
  delete: <T>(path: string) => request<T>(withStoreIdInPath(path), { method: 'DELETE' }),
  async getBlob(path: string): Promise<Blob> {
    const token = getToken();
    const res = await fetch(`${API_URL}${withStoreIdInPath(path)}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      throw new ApiError('Le téléchargement a échoué.', res.status);
    }
    return res.blob();
  },
  async postForm<T>(path: string, formData: FormData): Promise<T> {
    const token = getToken();
    const storeId = getActiveStoreId();
    if (storeId && !formData.has('storeId')) {
      formData.append('storeId', storeId);
    }
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      let body: any = {};
      try {
        body = await res.json();
      } catch {
        // pas de corps JSON
      }
      throw new ApiError(body.message ?? "L'envoi a échoué.", res.status, body.errors);
    }
    return res.json();
  },
};
