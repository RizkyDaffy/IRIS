import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { IrisConfig, PublishPayload, PublishResult } from './types.js';
import { IrisConfigError } from './errors.js';
import { HttpClient } from './httpClient.js';
import { BoundedQueue } from './queue.js';

export class Iris extends EventEmitter {
  private config: Required<Omit<IrisConfig, 'environment'>> & { environment?: string };
  private http: HttpClient;
  private queue: BoundedQueue;
  private isProcessingQueue = false;

  constructor(config: IrisConfig) {
    super();
    const token = config.projectToken || process.env.IRIS_PROJECT_TOKEN;
    if (!token || typeof token !== 'string') {
      throw new IrisConfigError('Missing projectToken. Set it via config or IRIS_PROJECT_TOKEN env var.');
    }

    this.config = {
      projectToken: token,
      gatewayUrl: config.gatewayUrl || 'http://localhost:3001/',
      timeoutMs: config.timeoutMs ?? 5000,
      retry: {
        maxAttempts: config.retry?.maxAttempts ?? 3,
        baseDelayMs: config.retry?.baseDelayMs ?? 200,
      },
      maxQueueSize: config.maxQueueSize ?? 1000,
      onQueueFull: config.onQueueFull ?? 'drop-oldest',
      failOnInitError: config.failOnInitError ?? false,
      environment: config.environment,
    };

    this.http = new HttpClient(this.config.gatewayUrl);
    this.queue = new BoundedQueue(this.config.maxQueueSize, this.config.onQueueFull);
  }

  async init(): Promise<void> {
    try {
      await this.http.request('/ingress/whoami', {
        method: 'GET',
        token: this.config.projectToken,
        timeoutMs: this.config.timeoutMs,
      });
    } catch (err) {
      this.emit('init:error', err);
      if (this.config.failOnInitError) {
        throw err;
      }
    }
  }

  async publish<T = unknown>(payload: PublishPayload<T>): Promise<PublishResult> {
    const idempotencyKey = payload.idempotencyKey || randomUUID();
    const fullPayload = { ...payload, idempotencyKey };

    try {
      await this.http.request('/ingress/publish', {
        method: 'POST',
        token: this.config.projectToken,
        body: fullPayload,
        timeoutMs: this.config.timeoutMs,
        retryAttempts: this.config.retry.maxAttempts,
        baseDelayMs: this.config.retry.baseDelayMs,
      });

      this.emit('publish:success', { idempotencyKey });
      return { status: 'sent', idempotencyKey };
    } catch (err: any) {
      this.emit('publish:failed', { idempotencyKey, error: err });

      // Fallback to queue
      return new Promise((resolve) => {
        const qStatus = this.queue.enqueue({ payload: fullPayload, resolve });
        if (qStatus === 'dropped') {
          this.emit('queue:full', { idempotencyKey });
          resolve({ status: 'dropped', idempotencyKey });
        } else {
          // If queued, we resolve with queued status. The queue processor might send it later.
          resolve({ status: 'queued', idempotencyKey });
          this.processQueue();
        }
      });
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      let item = this.queue.dequeue();
      while (item) {
        try {
          await this.http.request('/ingress/publish', {
            method: 'POST',
            token: this.config.projectToken,
            body: item.payload,
            timeoutMs: this.config.timeoutMs,
            retryAttempts: this.config.retry.maxAttempts,
            baseDelayMs: this.config.retry.baseDelayMs,
          });
          this.emit('publish:success', { idempotencyKey: item.payload.idempotencyKey });
        } catch (err) {
          // If it fails again after retries, it's dropped.
          this.emit('publish:failed', { idempotencyKey: item.payload.idempotencyKey, error: err });
        }
        item = this.queue.dequeue();
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Public API — used directly by callers and by discovery packages (§2.4 Flow B, iris.md)
  async syncRoutes(routes: import('./types.js').RouteSchema[]): Promise<void> {
    await this.http.request('/ingress/register', {
      method: 'POST',
      token: this.config.projectToken,
      body: routes,
      timeoutMs: this.config.timeoutMs,
      retryAttempts: 1, // cap at 1 — failed doc sync must not stall startup
      baseDelayMs: this.config.retry.baseDelayMs,
    });
  }

  /** @internal alias kept for discovery packages */
  readonly registerRoutes = this.syncRoutes;

  // §2.4 Flow C — best-effort drain on shutdown
  async flush(timeoutMs = 5_000): Promise<void> {
    if (this.queue.size === 0) return;
    await this.processQueue();
    // If still items (network kept failing), just discard — best-effort
    this.queue.clear();
  }
}
