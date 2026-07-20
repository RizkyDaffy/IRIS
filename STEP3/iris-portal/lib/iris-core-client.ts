// §0.3 — portal calls iris-core's admin API, never writes DB directly
// ponytail: thin typed wrapper over fetch — no SDK dep in the portal
const BASE = (process.env.IRIS_CORE_URL || 'http://localhost:3001').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  let res: Response;
  try {
    const defaultHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.IRIS_ADMIN_KEY) {
      defaultHeaders['X-Iris-Admin-Key'] = process.env.IRIS_ADMIN_KEY;
    }
    
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...defaultHeaders, ...(init?.headers as object) },
      cache: 'no-store',
    });
  } catch (err: any) {
    if (attempt === 0) return apiFetch(path, init, 1); // retry once on network error
    console.error(`[apiFetch Network Error] ${path}:`, err.message);
    throw new Error(`iris-core unreachable at ${BASE} — ${err.message}`);
  }

  if (res.status >= 500 && attempt === 0) return apiFetch(path, init, 1); // retry on 5xx

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
    console.error(`[apiFetch HTTP Error] ${res.status} ${path}:`, msg);
    throw new ApiError(res.status, `iris-core [${res.status}] ${path}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export interface App {
  id: string;
  name: string;
  targetUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { routes: number; outboxItems: number };
}

export interface AppDetail extends Omit<App, '_count'> {
  routes: Route[];
  routeSyncs: RouteSyncLog[];
  _count: { outboxItems: number; routes: number };
}

export interface Route {
  id: string;
  applicationId: string;
  path: string;
  method: string;
  description?: string;
  schema?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RouteSyncLog {
  id: string;
  applicationId: string;
  routeCount: number;
  sourceIp?: string;
  syncedAt: string;
}

export interface OutboxEvent {
  id: string;
  event: string;
  routingKey: string;
  status: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  publishedAt?: string;
  idempotencyKey?: string;
}

export const irisCore = {
  listApps: () => apiFetch<App[]>('/admin/applications'),
  getApp: (id: string) => apiFetch<AppDetail>(`/admin/applications/${id}`),
  createApp: (body: { name: string; targetUrl: string }) =>
    apiFetch<App & { token: string }>('/admin/applications', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchApp: (id: string, body: { targetUrl?: string; isActive?: boolean }) =>
    apiFetch<App>(`/admin/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  rotateToken: (id: string) =>
    apiFetch<{ token: string }>(`/admin/applications/${id}/rotate-token`, { method: 'POST' }),
  getEvents: (id: string, params: { status?: string; cursor?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    return apiFetch<OutboxEvent[]>(`/admin/applications/${id}/events?${qs}`);
  },
};
