import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// src/core/client.ts

// src/core/errors.ts
var IrisConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "IrisConfigError";
  }
};
var IrisApiError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "IrisApiError";
  }
  statusCode;
};

// src/core/httpClient.ts
var HttpClient = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  baseUrl;
  async request(path, options) {
    const url = new URL(path, this.baseUrl).toString();
    const attempts = options.retryAttempts ?? 0;
    const baseDelay = options.baseDelayMs ?? 200;
    let lastError = new Error("Request failed");
    for (let i = 0; i <= attempts; i++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const res = await fetch(url, {
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${options.token}`
          },
          body: options.body ? JSON.stringify(options.body) : void 0,
          signal: controller.signal
          // workaround for DOM vs Node types if needed
        });
        clearTimeout(id);
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            throw new IrisApiError(res.status, `HTTP Error ${res.status}`);
          }
          throw new IrisApiError(res.status, `HTTP Error ${res.status}`);
        }
        if (res.status === 204) return {};
        return await res.json();
      } catch (err) {
        clearTimeout(id);
        lastError = err;
        if (err instanceof IrisApiError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
          throw err;
        }
        if (i < attempts) {
          const delay = baseDelay * 2 ** i * (0.5 + Math.random() * 0.5);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
};

// src/core/queue.ts
var BoundedQueue = class {
  queue = [];
  maxSize;
  policy;
  constructor(maxSize, policy) {
    this.maxSize = maxSize;
    this.policy = policy;
  }
  enqueue(item) {
    if (this.queue.length >= this.maxSize) {
      if (this.policy === "reject-newest") {
        return "dropped";
      } else {
        const dropped = this.queue.shift();
        if (dropped) {
          dropped.resolve({ status: "dropped", idempotencyKey: dropped.payload.idempotencyKey });
        }
      }
    }
    this.queue.push(item);
    return "queued";
  }
  dequeue() {
    return this.queue.shift();
  }
  get size() {
    return this.queue.length;
  }
  clear() {
    this.queue = [];
  }
};

// src/core/client.ts
var Iris = class extends EventEmitter {
  config;
  http;
  queue;
  isProcessingQueue = false;
  constructor(config) {
    super();
    const token = config.projectToken || process.env.IRIS_PROJECT_TOKEN;
    if (!token || typeof token !== "string") {
      throw new IrisConfigError("Missing projectToken. Set it via config or IRIS_PROJECT_TOKEN env var.");
    }
    this.config = {
      projectToken: token,
      gatewayUrl: config.gatewayUrl || "http://localhost:3001/",
      timeoutMs: config.timeoutMs ?? 5e3,
      retry: {
        maxAttempts: config.retry?.maxAttempts ?? 3,
        baseDelayMs: config.retry?.baseDelayMs ?? 200
      },
      maxQueueSize: config.maxQueueSize ?? 1e3,
      onQueueFull: config.onQueueFull ?? "drop-oldest",
      failOnInitError: config.failOnInitError ?? false,
      environment: config.environment
    };
    this.http = new HttpClient(this.config.gatewayUrl);
    this.queue = new BoundedQueue(this.config.maxQueueSize, this.config.onQueueFull);
  }
  async init() {
    try {
      await this.http.request("/ingress/whoami", {
        method: "GET",
        token: this.config.projectToken,
        timeoutMs: this.config.timeoutMs
      });
    } catch (err) {
      this.emit("init:error", err);
      if (this.config.failOnInitError) {
        throw err;
      }
    }
  }
  async publish(payload) {
    const idempotencyKey = payload.idempotencyKey || randomUUID();
    const fullPayload = { ...payload, idempotencyKey };
    try {
      await this.http.request("/ingress/publish", {
        method: "POST",
        token: this.config.projectToken,
        body: fullPayload,
        timeoutMs: this.config.timeoutMs,
        retryAttempts: this.config.retry.maxAttempts,
        baseDelayMs: this.config.retry.baseDelayMs
      });
      this.emit("publish:success", { idempotencyKey });
      return { status: "sent", idempotencyKey };
    } catch (err) {
      this.emit("publish:failed", { idempotencyKey, error: err });
      return new Promise((resolve) => {
        const qStatus = this.queue.enqueue({ payload: fullPayload, resolve });
        if (qStatus === "dropped") {
          this.emit("queue:full", { idempotencyKey });
          resolve({ status: "dropped", idempotencyKey });
        } else {
          resolve({ status: "queued", idempotencyKey });
          this.processQueue();
        }
      });
    }
  }
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    try {
      let item = this.queue.dequeue();
      while (item) {
        try {
          await this.http.request("/ingress/publish", {
            method: "POST",
            token: this.config.projectToken,
            body: item.payload,
            timeoutMs: this.config.timeoutMs,
            retryAttempts: this.config.retry.maxAttempts,
            baseDelayMs: this.config.retry.baseDelayMs
          });
          this.emit("publish:success", { idempotencyKey: item.payload.idempotencyKey });
        } catch (err) {
          this.emit("publish:failed", { idempotencyKey: item.payload.idempotencyKey, error: err });
        }
        item = this.queue.dequeue();
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  // Used by discovery packages
  async registerRoutes(routes) {
    await this.http.request("/ingress/register", {
      method: "POST",
      token: this.config.projectToken,
      body: routes,
      timeoutMs: this.config.timeoutMs,
      retryAttempts: 1,
      // Cap retry count at 1 per spec §2.4 Flow B
      baseDelayMs: this.config.retry.baseDelayMs
    });
  }
};

export { Iris, IrisApiError, IrisConfigError };
