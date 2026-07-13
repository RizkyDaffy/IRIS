import { EventEmitter } from 'events';

interface IrisConfig {
    projectToken: string;
    gatewayUrl?: string;
    environment?: 'development' | 'production';
    timeoutMs?: number;
    retry?: {
        maxAttempts?: number;
        baseDelayMs?: number;
    };
    maxQueueSize?: number;
    onQueueFull?: 'drop-oldest' | 'reject-newest';
    failOnInitError?: boolean;
}
interface RouteSchema {
    path: string;
    method: string;
    description?: string;
    schema?: Record<string, unknown>;
}
interface PublishPayload<T = unknown> {
    event: string;
    data: T;
    idempotencyKey?: string;
}
interface PublishResult {
    status: 'sent' | 'queued' | 'dropped' | 'failed';
    idempotencyKey: string;
}

declare class Iris extends EventEmitter {
    private config;
    private http;
    private queue;
    private isProcessingQueue;
    constructor(config: IrisConfig);
    init(): Promise<void>;
    publish<T = unknown>(payload: PublishPayload<T>): Promise<PublishResult>;
    private processQueue;
    registerRoutes(routes: any[]): Promise<void>;
}

export { Iris as I, type PublishPayload as P, type RouteSchema as R, type IrisConfig as a, type PublishResult as b };
