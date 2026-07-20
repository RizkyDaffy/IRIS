// §2.3 — Core Types

export interface IrisConfig {
  projectToken: string;
  gatewayUrl?: string; // default: http://localhost:3001/
  environment?: 'development' | 'production';
  timeoutMs?: number; // default: 5000
  retry?: {
    maxAttempts?: number; // default: 3
    baseDelayMs?: number; // default: 200
  };
  maxQueueSize?: number; // default: 1000
  onQueueFull?: 'drop-oldest' | 'reject-newest'; // default: 'drop-oldest'
  failOnInitError?: boolean; // default: false
}

export interface RouteSchema {
  path: string;
  method: string;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface PublishPayload<T = unknown> {
  event: string;
  data: T;
  idempotencyKey?: string;
}

export interface PublishResult {
  status: 'sent' | 'queued' | 'dropped' | 'failed';
  idempotencyKey: string;
}
