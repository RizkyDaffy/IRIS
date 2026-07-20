import { IrisApiError } from './errors.js';

interface FetchOptions {
  method: string;
  body?: unknown;
  timeoutMs: number;
  token: string;
}

// @rizkydaffy: native fetch wrapped with timeout and retry logic
export class HttpClient {
  constructor(private baseUrl: string) { }

  async request<T>(path: string, options: FetchOptions & { retryAttempts?: number; baseDelayMs?: number }): Promise<T> {
    const url = new URL(path, this.baseUrl).toString();
    const attempts = options.retryAttempts ?? 0;
    const baseDelay = options.baseDelayMs ?? 200;

    let lastError: Error = new Error('Request failed');

    for (let i = 0; i <= attempts; i++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const res = await fetch(url, {
          method: options.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.token}`
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal as any // workaround for DOM vs Node types if needed
        });
        clearTimeout(id);

        if (!res.ok) {
          // Never retry 4xx
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            throw new IrisApiError(res.status, `HTTP Error ${res.status}`);
          }
          throw new IrisApiError(res.status, `HTTP Error ${res.status}`);
        }

        if (res.status === 204) return {} as T;
        return await res.json() as T;
      } catch (err: any) {
        clearTimeout(id);
        lastError = err;

        if (err instanceof IrisApiError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
          throw err;
        }

        if (i < attempts) {
          const delay = baseDelay * (2 ** i) * (0.5 + Math.random() * 0.5);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }
}
