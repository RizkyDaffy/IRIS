# SYSTEM INSTRUCTION: IRIS ECOSYSTEM — UNIFIED PRODUCTION ENGINEERING SPECIFICATION

You are a Principal Software Engineer responsible for the full "Iris" ecosystem: `iris-core` (the gateway), `@sugity/iris-node` (the SDK), and `iris-portal` (the dashboard). These are three separate repositories, but they share data models and network contracts, and this document is the single source of truth for both. **Read Part 0 in full before touching any of Parts 1–3** — it exists specifically because building these three services from separately-written specs produced real inconsistencies (a secret credential exposed in URLs, a health-check endpoint one service called and another never defined, a data field one service assumed and another never sent). Part 0 is what makes the three repos actually interoperate; Parts 1–3 are the per-service implementation detail.

**If instead you're asked to connect a client app to an already-running Iris ecosystem** (not build the ecosystem itself), go straight to **Part 0.5** — it covers setup, the token requirement, and per-stack installation guides for that job.

**Recommended build order:** Part 1 (`iris-core`) and put it on 'STEP1' folder first — it owns the database schema and the endpoints the other two depend on. Part 2 (`@sugity/iris-node`) and put it on 'STEP2' folder second — it only needs the gateway's ingress/handshake endpoints to exist. Part 3 (`iris-portal`) and put it on 'STEP3' folder last — it depends on both the shared schema package from Part 1 and, indirectly, on real route data having been registered by an app using the Part 2 SDK.

---

# PART 0.5 — GETTING STARTED: INTEGRATING A CLIENT APP

> This part governs a different job than Parts 1–3: it's for when you (the agent) are asked to connect **someone else's application** (e.g. "Henkaten", or any client microservice) to an *already-running* Iris ecosystem, rather than building `iris-core`/`@sugity/iris-node`/`iris-portal` from scratch. Read this part before writing any client-side integration code. It follows the same setup → guide → troubleshooting flow as `docs.md`.

## 0.5.1 Architecture at a Glance

```mermaid
sequenceDiagram
    participant C as Client App (e.g. Henkaten)
    participant G as Iris Gateway (iris-core)
    participant P as Iris Portal

    Note over C,G: 1. SDK Registration (Startup / CLI)
    C->>G: POST /ingress/register (Bearer Token) + Route Schema
    G-->>C: 200 Accepted (Stored in DB)

    Note over C,G: 2. Async Event Publishing
    C->>G: POST /ingress/publish (Bearer Token) + Payload
    G-->>C: 202 Accepted (Added to Outbox)

    Note over G,P: 3. Portal Dashboard
    P->>G: Reads Application/Route/EventOutbox directly via @iris/db (Prisma, §0.3) — not an unauthenticated HTTP call
    P->>User: Renders API docs & Event terminal
```

- **`iris-core`** is the central gateway — single source of truth for the database (Postgres, §1.3) and RabbitMQ.
- **Client SDKs** (PHP or JS/Node) live inside the client app. They never touch the database directly; they only speak HTTP to `/ingress/*` using the app's bearer token (§0.1).
- **`iris-portal`** reads `Application`/`Route`/`EventOutbox` directly against `@iris/db` (§0.3) — it does not hit an unauthenticated gateway endpoint for this, correcting an earlier draft of this diagram that implied otherwise.

## 0.5.2 Zero-Config Discovery: Current Status

> **⚠️ NOT YET PART OF THIS SPEC.** A fully zero-config flow — client app boots, generates a keypair, hits a one-time provisioning slug at something like `POST /ingress/handshake`, and receives a token with no human copy-paste — is a plausible future direction, but Part 1 of this spec does **not** define a `/ingress/handshake` endpoint, and no such flow exists.
>
> **What actually happens today:** a human creates the `Application` (via the Portal's "+ New Application" or an admin script), which generates the `IRIS_PROJECT_TOKEN`. That token is then pasted into the client app's `.env` as `IRIS_PROJECT_TOKEN`. There is no automatic way for an agent to obtain this token on the client app's behalf — see §0.5.3.

## 0.5.3 MANDATORY — Confirm the Token Before Writing Integration Code

**This rule is non-negotiable and applies to every client-integration task ("add Iris to this project," "wire up the SDK," etc.):**

1. Check whether `IRIS_PROJECT_TOKEN` is already available: either given explicitly in the user's message, or present in a `.env` file you can read in the project.
2. If it is present in either place, proceed with integration using that value.
3. If it is **not** present in either place, **stop and ask the user for it** before writing or running any integration code. Tell them to get it from the Iris Portal: **+ New Application** → name the app → copy the secret token shown on screen (shown exactly once, per Step 0 below) → provide it to you, or have them paste it into their own `.env`.
4. Never invent, guess, or silently scaffold code around a placeholder value (e.g. `your_token_here`) as if it were a real token, and never fabricate one. Code that ships with a fake token fails at `init()`/`syncRoutes()`/`publish()` with `401 INVALID_TOKEN`, which is a worse outcome than asking up front.
5. **Exception:** this rule doesn't apply when the task is building the infrastructure itself (Parts 1–3) — there's no token to check for `iris-core`, the SDK, or the portal, since those are what *issue* tokens, not consume them.

### Step 0 — Get a Token (one-time, human step)

1. Open the Iris Portal → **+ New Application**.
2. Enter a name (e.g. `my-billing-service`) and the app's local URL (e.g. `http://localhost:4000`) — this becomes `targetUrl` (§1.3, validated against `ALLOWED_TARGET_CIDRS`).
3. Copy the secret token shown on screen — it is shown exactly once.
4. Store it as `IRIS_PROJECT_TOKEN` in the client app's environment.

## 0.5.4 Installation Guide — PHP / Laravel

The PHP SDK is a single, zero-dependency file (`Iris.php`) — no Composer package.

1. Copy `Iris.php` into the Laravel app (e.g. `app/Services/Iris.php`).
2. Register it via a Service Provider (`app/Providers/IrisServiceProvider.php`).

**`.env`:**
```env
IRIS_PROJECT_TOKEN=your_generated_token_here
IRIS_GATEWAY_URL=http://localhost:3001
```

**Route sync — `php artisan iris:sync`:** In Laravel 11, routing files load *after* Service Providers boot, and syncing on every `boot()` would add 100ms+ to every request — so routes are **not** synced automatically. Use the artisan command instead:
```bash
php artisan iris:sync
```
It loads the framework, extracts routes via `Route::getRoutes()`, normalizes them into the `RouteSchema` shape (§0.4), and makes a single `POST /ingress/register` call using the `.env` token. It does not cache schemas locally or re-issue tokens — it just pushes current state. Run it manually when routes change, or wire it into CI/CD on deploy.

**Publishing an event:**
```php
use App\Services\Iris;

public function completeOrder(Iris $iris) {
    // Process order...
    $iris->publish('order_completed', ['order_id' => 123]);
}
```

## 0.5.5 Installation Guide — JS / Node

```bash
npm install @sugity/iris-node
```

**`.env`:**
```env
IRIS_PROJECT_TOKEN=your_generated_token_here
IRIS_GATEWAY_URL=http://localhost:3001
```

Long-running Node apps (Express, Fastify) build their route trees synchronously at startup, so the JS SDK ships framework-specific discovery wrappers (§2.4 Flow B) that hook into this:

```typescript
import express from 'express';
import { Iris } from '@sugity/iris-node';
import { registerExpressApp } from '@sugity/iris-node/express';

const iris = new Iris(); // picks up IRIS_PROJECT_TOKEN automatically
const app = express();

app.get('/api/users', (req, res) => res.send([]));

app.listen(3000, async () => {
    await iris.init();                     // validates token against /ingress/whoami, §0.2
    await registerExpressApp(iris, app);    // auto-discovers Express stack, POSTs to /ingress/register
});
```

`registerExpressApp` walks the internal `app._router.stack`, pulls out defined paths/methods, normalizes regex paths, and syncs them to the gateway (§2.4 Flow B has the full contract, including the fallback-to-empty-set behavior on unrecognized shapes).

**Publishing an event:**
```typescript
app.post('/api/checkout', async (req, res) => {
    // publish() falls back to a bounded in-memory queue if the gateway is down — §2.4 Flow C
    await iris.publish({ event: 'checkout_started', data: req.body });
    res.send('ok');
});
```

## 0.5.6 Troubleshooting & Maintenance

**1. Route count shows 0 in portal (PHP/Laravel)**
- *Cause:* `$iris->syncRoutes()` was called inside a Service Provider's `boot()` in Laravel 11.
- *Fix:* Use `php artisan iris:sync` — the routes don't exist yet when `boot()` runs.

**2. "Failed to connect to iris-core [401]" in Portal**
- *Cause:* A zombie Node process is still running on the gateway's port, intercepting requests with stale code.
- *Fix:* Kill the stale process on that port and restart the gateway.

**3. "Unauthorized: invalid token" during `iris:sync` or `iris.init()`**
- *Cause:* `IRIS_PROJECT_TOKEN` doesn't match any `Application.tokenHash` in the gateway's database (§1.3).
- *Fix:* Confirm the gateway is pointed at the right `DATABASE_URL`, or generate a new token via the Portal and update `.env`. Never try to fix this by hardcoding or guessing a token — re-confirm per §0.5.3.

**4. Prisma "Can't reach database server"**
- *Cause:* The local Postgres instance isn't running (e.g. after a machine restart).
- *Fix:* Start the database service; no other config changes needed.

---

# PART 0 — ECOSYSTEM-WIDE CONTRACTS

## 0.1 Two Identifiers, Not One

Every `Application` has two distinct identifiers with different sensitivity levels. Conflating them was the single biggest issue found when the three phases were designed independently — the gateway's proxy path used the secret token as a URL segment, and the portal (correctly) tried to avoid doing that for its own pages but had nothing else to route on.

* **`Application.id`** (`cuid`) — non-secret. Used in **every** URL across all three services: the gateway's proxy path (`/app/:appId/api/*`), every portal page (`/app/[appId]/...`), and any copy-paste `curl` example. Treat it like a username — identifying, not secret. Safe in browser history, logs, and shared links.
* **The bearer token** — secret. Shown to the developer exactly once, at creation. Stored only as an Argon2id hash (`tokenHash`) plus a short `tokenPrefix` for fast candidate lookup — never stored or logged in plaintext. Used **only** inside an `Authorization: Bearer <token>` header, for:
  1. Invoking the gateway's own reverse proxy (`/app/:appId/api/*`)
  2. `POST /ingress/register`
  3. `POST /ingress/publish`
  4. `GET /ingress/whoami` (§0.2)

  Never placed in a URL, a query string, or any string a UI renders as one-click-copyable by default.

This means the gateway's proxy endpoint is **not** `/app/:token/api/*` as a first-draft design might assume — it's `/app/:appId/api/*`, and the handler must additionally require and verify an `Authorization` header. Getting the secret out of the portal's URLs only matters if the underlying gateway invocation also doesn't require it in a URL — fix it once, at the gateway, and both problems disappear together.

## 0.2 Endpoints: Infra Probes vs. Authenticated Handshake

Two different needs were conflated in early drafts of this spec ("ping `/api/health` to verify the token") — a liveness probe and a per-app credential check are not the same thing and shouldn't share an endpoint:

* `GET /healthz` — liveness only. No auth, no dependency checks. For the orchestrator.
* `GET /readyz` — readiness. No auth. Reports Postgres and RabbitMQ connectivity. For the orchestrator.
* `GET /ingress/whoami` — **authenticated** (`Authorization: Bearer <token>` required). Returns `{ id, name, isActive }` on success, `401` on missing/invalid token. **This is what the SDK's `init()` calls**, not `/healthz` — a bare liveness check can't tell a developer whether their token is actually valid, which is the thing `init()` is supposed to confirm.

## 0.3 One Schema, One Owner

`iris-core` owns `prisma/schema.prisma` and all migrations. It's published as an internal shared package, `@iris/db` (schema + generated client), consumed by both `iris-core` and `iris-portal`. **No repository hand-copies or "mirrors" the schema file.** Two independently maintained copies of the same schema will drift, and if two codebases can each independently write `tokenHash` or `targetUrl`, the validation/hashing/audit-logging logic for those fields has to be correct in two places instead of one — that's not a hypothetical risk, it's just a matter of time.

Corollary: **`iris-portal` does not write to `Application`, `Route`, or `EventOutbox` directly.** It reads directly (ideally against a read replica). All mutations — token rotation, `targetUrl` changes, app deactivation — go through `iris-core`'s own authenticated API, so the SSRF allowlist check on `targetUrl` (§1, Flow A) and the token-hashing logic can't be bypassed by a second write path that forgot to reimplement them.

## 0.4 Event & Route Contracts (shared types)

These are the literal shapes that cross the wire between the SDK and the gateway, and between the gateway's database and the portal's display layer. Implement them identically in both TypeScript codebases (`iris-core`'s Zod schemas and `@sugity/iris-node`'s exported types) — don't let them drift into "close enough."

```typescript
// POST /ingress/publish body — sent by the SDK, accepted by the gateway
interface PublishPayload<T = unknown> {
  event: string;
  data: T;
  idempotencyKey?: string; // SDK always sends one (auto-generated); gateway treats it as optional
                            // at the API boundary so the endpoint isn't SDK-only, but stores it on
                            // EventOutbox.idempotencyKey (unique) to dedupe retried publishes.
}

// POST /ingress/register body — sent by the SDK, stored by the gateway, rendered by the portal
interface RouteSchema {
  path: string;
  method: string;
  description?: string;
  schema?: Record<string, unknown>; // JSON-Schema-ish shape of the expected request payload.
  // NOTE: an earlier SDK draft omitted this field entirely, even though the gateway's `Route.schema`
  // column existed for it and the portal's docs view was written assuming it would be populated.
  // The field must exist in the SDK's public type or the portal has nothing to render there — best-effort/
  // optional on the SDK caller's part, but present in the contract.
}
```

## 0.5 Shared Error Envelope

Every gateway API response — including ones the SDK and portal need to parse — uses this shape:

```json
{ "error": { "code": "APPLICATION_NOT_FOUND", "message": "...", "requestId": "b3f1..." } }
```

## 0.6 Shared Config Conventions

* Gateway default base URL: `http://localhost:3001/` — this is the SDK's `IrisConfig.gatewayUrl` default and the base every portal `curl` example is built from.
* SDK-side env var: `IRIS_PROJECT_TOKEN`.
* Gateway-side env vars: `DATABASE_URL`, `RABBITMQ_URL`, `PORT`, `LOG_LEVEL`, `TOKEN_CACHE_TTL_MS`, `ALLOWED_TARGET_CIDRS`.

---

# PART 1 — `iris-core` (THE GATEWAY)

## 1.1 Tech Stack

Node.js 20 LTS, TypeScript strict mode, Fastify, `zod` for all runtime validation (env, request bodies), Prisma + PostgreSQL, `@fastify/http-proxy` (fallback plan: hand-rolled `undici` proxying if per-app timeout/retry needs outgrow the plugin), `amqplib` wrapped in a reconnection manager, `pino` with secret redaction, `@fastify/helmet`, `@fastify/rate-limit`, `prom-client`, `vitest` + `testcontainers` for integration tests, `@fastify/swagger` for docs.

## 1.2 Directory Architecture

```text
iris-core/
├── prisma/
│   ├── schema.prisma            # single source of truth — see §0.3
│   └── migrations/
├── src/
│   ├── config/{env.ts,rabbit.ts}
│   ├── errors/AppError.ts       # taxonomy → the §0.5 envelope
│   ├── schemas/                 # zod schemas matching §0.4 types exactly
│   ├── middleware/auth.ts       # resolves appId → Application, verifies Authorization header
│   ├── plugins/cache.ts         # token-verification LRU/TTL cache
│   ├── routes/{ingress.ts,proxy.ts,health.ts,whoami.ts}
│   ├── services/{db.ts,broker.ts,outbox.ts}
│   ├── workers/outboxWorker.ts
│   └── app.ts
├── tests/{unit,integration}/
├── docker/Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## 1.3 Database Schema

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model Application {
  id          String         @id @default(cuid())   // non-secret — see §0.1
  name        String         @unique
  targetUrl   String         // validated against ALLOWED_TARGET_CIDRS on write
  tokenHash   String         @unique                // Argon2id — see §0.1
  tokenPrefix String
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  routes      Route[]
  routeSyncs  RouteSyncLog[]
  outboxItems EventOutbox[]

  @@index([tokenPrefix])
}

model Route {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  path          String
  method        String
  description   String?
  schema        Json?       // populated per §0.4's RouteSchema.schema
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([applicationId, path, method])
  @@index([applicationId])
}

model RouteSyncLog {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  routeCount    Int
  sourceIp      String?
  syncedAt      DateTime    @default(now())

  @@index([applicationId])
}

model EventOutbox {
  id             String      @id @default(cuid())
  applicationId  String
  application    Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  event          String
  routingKey     String
  payload        Json
  idempotencyKey String?     @unique
  status         String      @default("pending")   // pending | published | failed
  attempts       Int         @default(0)
  lastError      String?
  createdAt      DateTime    @default(now())
  publishedAt    DateTime?

  @@index([status, createdAt])
}
```

Run migrations via `prisma migrate deploy` as a discrete CI/CD step — never on application boot.

## 1.4 Core Flows

### Flow A — Reverse Proxy: `/app/:appId/api/*`

1. Extract `:appId` from the path and the token from the `Authorization: Bearer <token>` header — **not** from the URL (§0.1).
2. If `Authorization` is missing or malformed, `401` immediately, before any DB lookup.
3. Look up `Application` by `id`. If not found or `isActive` is false, `404` — this is safe to be a generic 404 since `appId` isn't secret; it just means the target doesn't exist or was deactivated.
4. If found, verify the header token against `tokenHash` with a constant-time comparison (Argon2 verify). Cache successful verifications in-memory keyed by a SHA-256 of the token (not the raw token), short TTL (10–30s), documented as per-instance and therefore eventually consistent across replicas — a Phase 2/Redis-backed shared cache is a noted future improvement, not required now. Invalid token → `401`.
5. Strip hop-by-hop headers (`Connection`, `Keep-Alive`, `Transfer-Encoding`, `Upgrade`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`), inject `X-Request-Id`/`X-Forwarded-For`, stream to `targetUrl` with a bounded timeout (default 10s, configurable).
6. Distinguish `504` (upstream timeout), `502` (upstream unreachable), `500` (Iris-side error) — an on-call engineer needs to know instantly which side broke.
7. `targetUrl` is validated at registration/update time against `ALLOWED_TARGET_CIDRS` (an operator-configured internal allowlist), not a blanket private-IP block — this gateway's job is routing to internal services, so the allowlist (not a blanket rule) is what prevents a target pointing somewhere unintended.

### Flow B — SDK Ingress: `POST /ingress/register`

Validate against the `RouteSchema[]` zod schema (§0.4). Verify token as in Flow A (looked up via the resolved `Application`, not a separate token-in-URL mechanism). Replace the app's route set inside one `prisma.$transaction` (`deleteMany` + `createMany`) so a crash mid-sync never leaves a partial table. Write a `RouteSyncLog` row. Rate-limit per app (e.g. 10/min).

### Flow C — Event Publishing: `POST /ingress/publish`

Durable outbox, not fire-and-forget:

1. Validate against `PublishPayload` (§0.4).
2. Write to `EventOutbox` (`status: "pending"`) — this write is the durability guarantee, succeeding even if RabbitMQ is fully down.
3. Return `202 Accepted` once committed.
4. Background worker polls `pending` rows, publishes via a `confirmChannel` (publisher confirms — a bare `channel.publish()` doesn't guarantee broker acceptance) to the `iris.events` topic exchange, routing key `[appName].[eventName]`.
5. On failure: increment `attempts`, exponential backoff, mark `failed` after a max-attempts ceiling and log at `error` with enough context to replay manually.

### Flow D — Authenticated Handshake: `GET /ingress/whoami`

Per §0.2 — verify the `Authorization` header exactly as in Flow A, return `{ id, name, isActive }` on success. This is the endpoint the SDK's `init()` actually calls.

## 1.5 AMQP Connection Management

Reconnect with exponential backoff + jitter (capped interval, e.g. 30s). Expose connection state (`connected | reconnecting | disconnected`) for `/readyz`. Route handlers and the outbox worker never hold a channel reference directly — they ask the connection manager for the current one.

## 1.6 Security

Env validation at boot via zod (fail-fast, not `undefined` config in prod). Argon2id token hashing (§0.1). `@fastify/rate-limit` per resolved application. Body size limits on ingress endpoints. `@fastify/helmet`. `pino` redaction on `Authorization` and raw tokens. SSRF defense per Flow A step 7.

## 1.7 Observability, Resilience, Testing, CI/CD

* **Logging:** `pino`, one JSON line per request: `requestId`, `applicationId` (once resolved), method, path, status, duration.
* **Metrics** (`/metrics`): proxy latency histogram by app/status class, outbox publish success/failure counters, AMQP reconnect counter, rate-limit rejection counter.
* **Graceful shutdown:** `SIGTERM`/`SIGINT` → stop accepting connections, drain in-flight requests, close Prisma, close AMQP cleanly, bounded window for the outbox worker to finish its batch.
* **Testing:** unit tests for token verification and outbox backoff math; `testcontainers`-based integration tests covering register → route storage, publish → outbox → broker delivery (including a broker-outage-then-recovery scenario), and proxy routing against a mocked upstream.
* **CI/CD:** lint → typecheck → tests → dependency audit → build → Docker build; `prisma migrate deploy` as its own pipeline step, decoupled from app boot.

## 1.8 Definition of Done — Part 1

- [ ] Proxy path is `/app/:appId/api/*` with a required `Authorization` header — no secret token anywhere in a URL.
- [ ] `/ingress/whoami` implemented and distinct from `/healthz`/`/readyz`.
- [ ] Raw token shown exactly once, at creation; only `tokenHash`/`tokenPrefix` persisted.
- [ ] Broker-outage integration test passes: publish still returns `202` and the event lands in `EventOutbox`, then gets published once RabbitMQ recovers.
- [ ] `@iris/db` package published/available for `iris-portal` to consume (§0.3).

---

# PART 2 — `@sugity/iris-node` (THE SDK)

## 2.1 Tech Stack

Node.js ≥18, TypeScript strict, zero runtime dependencies (native `fetch` + `AbortController`), dual CJS/ESM build via `tsup`, Changesets for semver discipline, `vitest` + `undici`'s `MockAgent` (dev-only) for tests.

## 2.2 Directory Architecture

```text
iris-node-sdk/
├── src/
│   ├── core/{client.ts,httpClient.ts,queue.ts,errors.ts,types.ts}
│   ├── discovery/{express.ts,fastify.ts,shared.ts}   # subpath exports — see §2.5
│   └── index.ts                                        # exports only `Iris`, types, errors
├── tests/{unit,fixtures}/
├── examples/{express,fastify}/
└── .github/workflows/ci.yml
```

## 2.3 Core Types

```typescript
export interface IrisConfig {
  projectToken: string;
  gatewayUrl?: string;                 // default per §0.6
  environment?: 'development' | 'production';
  timeoutMs?: number;                  // default 5000
  retry?: { maxAttempts?: number; baseDelayMs?: number }; // default 3 / 200ms, exp backoff + jitter
  maxQueueSize?: number;               // default 1000
  onQueueFull?: 'drop-oldest' | 'reject-newest';
  failOnInitError?: boolean;           // default false — see Flow A
}

export type RouteSchema = /* exactly §0.4's RouteSchema, including `schema` */;
export type PublishPayload<T = unknown> = /* exactly §0.4's PublishPayload */;

export interface PublishResult {
  status: 'sent' | 'queued' | 'dropped' | 'failed';
  idempotencyKey: string;
}
```

## 2.4 Core Flows

### Flow A — Initialization (`Iris` class — public name, resolving the `IrisClient`/`Iris` naming conflict in an earlier draft)

* **Constructor (sync, throws on programmer error only):** resolve `projectToken` from explicit config or `IRIS_PROJECT_TOKEN`; throw `IrisConfigError` immediately if missing/malformed, naming the exact fix. No network call in the constructor.
* **`init()` (async, environment-tolerant by default):** calls `GET /ingress/whoami` (§0.2 — not a generic health check) with the configured timeout. On failure, emit `'init:error'` and resolve anyway by default (a transient gateway outage at boot must not crash an unrelated host app); reject instead only if `failOnInitError: true` (useful for a CI/deploy-time smoke test that should fail loudly).

### Flow B — Auto-Discovery (`src/discovery/express.ts`, `src/discovery/fastify.ts`)

* Express: walking `app._router.stack` touches an internal, version-fragile structure — wrap the whole walk in `try/catch`, recursively descend nested routers, skip/normalize regex-only paths, dedupe `(path, method)` pairs, and on any unrecognized shape emit `'discovery:warning'` and return an empty set rather than throwing.
* Fastify: use the `onRoute` hook — a stable public API, structurally more reliable than the Express approach.
* Idempotent on repeat calls (e.g. dev-mode hot reload shouldn't duplicate registrations).
* `syncRoutes()` posts the normalized `RouteSchema[]` (§0.4, including `schema` where the caller supplied one) to `/ingress/register`, capped at a low retry count (e.g. 1) so a failed doc sync doesn't delay app startup.

### Flow C — Event Publishing (`Iris.publish()`)

Accepts `PublishPayload<T>`; auto-generates `idempotencyKey` via `crypto.randomUUID()` if omitted (§0.4). Attempts immediate send with a timeout; retries transient failures (network error, timeout, 5xx) with exponential backoff + jitter up to `retry.maxAttempts` — **never retries 4xx**. On exhausted retries, falls into a bounded in-memory queue (`maxQueueSize`, `onQueueFull` policy) rather than growing unbounded, emitting `'queue:full'` when it happens. Returns `Promise<PublishResult>`; callers may fire-and-forget or await. `iris.flush()` (or an internal `SIGTERM` handler) makes a best-effort attempt to drain the queue on shutdown.

## 2.5 Observability, DX Contract, Packaging

`Iris` extends Node's built-in `EventEmitter` (core, not a dependency): `init:error`, `publish:success`, `publish:retry`, `publish:failed`, `queue:full`, `discovery:warning`.

```javascript
import express from 'express';
import { Iris } from '@sugity/iris-node';
import { registerExpressApp } from '@sugity/iris-node/express';

const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN });
const app = express();

app.post('/api/absence', (req, res) => {
  iris.publish({ event: 'absence_updated', data: req.body }); // fire-and-forget is fine
  res.send('Success');
});

app.listen(3000, async () => {
  await iris.init();
  await registerExpressApp(iris, app);
});
```

Framework integrations live in separate subpath exports (`/express`, `/fastify`) so the core client stays framework-agnostic and a Fastify-only consumer never bundles Express-sniffing code. `package.json` `exports` map covers root + both subpaths with `types`/`import`/`require` conditions; `sideEffects: false`; `files` limited to `dist/`.

## 2.6 Testing & CI/CD

Unit tests (mocked `fetch`, fake timers) for retry/backoff timing, 4xx-never-retries, queue backpressure. Discovery fixture tests for nested/regex Express routes and Fastify's `onRoute`, asserting `discovery:warning` fires on malformed input rather than throwing. A CI step that actually `require()`s the CJS build and `import`s the ESM build to catch `exports`-map misconfiguration. Matrix-tested on Node 18/20/22; releases via Changesets with npm provenance.

## 2.7 Definition of Done — Part 2

- [ ] `init()` calls `/ingress/whoami`, not a generic health endpoint.
- [ ] Constructor throws only on config problems; `init()` never throws unless `failOnInitError: true`.
- [ ] `RouteSchema` includes `schema?: Record<string, unknown>` (§0.4).
- [ ] `publish()` retries transient failures, skips 4xx, falls back to a bounded queue with an observable backpressure event.
- [ ] `exports` map verified by an actual CJS+ESM smoke test in CI.

---

# PART 3 — `iris-portal` (THE DASHBOARD)

## 3.1 Tech Stack

Next.js 14+ (App Router), TypeScript strict, Tailwind + Shadcn UI, `@tanstack/react-table` (server-side pagination/sorting) + `@tanstack/react-virtual` for the event terminal, Lucide React, SSO/OIDC auth.

## 3.2 Directory Architecture

```text
iris-portal/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # Service Catalog
│   │   └── app/[appId]/                   # §0.1 — never [token]
│   │       ├── page.tsx
│   │       ├── not-found.tsx
│   │       ├── docs/page.tsx
│   │       └── events/{page.tsx,stream/route.ts}
│   ├── components/{ui,api-explorer.tsx,event-terminal.tsx,token-reveal-dialog.tsx}
│   ├── lib/{db.ts,iris-core-client.ts,auth.ts,permissions.ts}
│   └── middleware.ts
├── tests/{unit,e2e}/
└── .github/workflows/ci.yml
```

Note: **no `prisma/schema.prisma` in this repo** — it depends on the `@iris/db` package from Part 1 (§0.3).

## 3.3 Core Views

### View A — Service Catalog (`/`)

Header metrics (apps, routes, throughput — sourced from the same `/metrics` as Part 1, not recomputed independently). Server-paginated table of `Application` rows; row click → `/app/[appId]`.

### View B — API Explorer (`/app/[appId]/docs`)

Query `Application` by `id` (§0.1) with its `Route`s. Group by HTTP method with color **and** a text label (accessibility — color alone isn't sufficient). Render `description`/`schema` through React's default escaping — both originate from third-party SDK calls (§0.4) and must never go through `dangerouslySetInnerHTML`. Filter state lives in the URL query string. **"Copy curl" now includes the auth header, not just the URL** (per §0.1's Flow A change):

```bash
curl -X POST http://localhost:3001//app/{appId}/api/path \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

The `<YOUR_TOKEN>` placeholder is deliberate — the button copies the shareable part only; an authorized user fetches their own real token separately via the token-reveal dialog (§3.5), never bundled into a copyable string alongside the URL.

### View C — Real-Time Event Stream (`/app/[appId]/events`)

A single process (living inside `iris-core` or as its own small service) maintains one AMQP consumer on `iris.events` and fans events out over Server-Sent Events to `/app/[appId]/events/stream`. If the portal is deployed serverless, this fan-out must live in the separate service, not in a per-request/per-instance AMQP connection (a connection storm waiting to happen) — state the deployment assumption explicitly in the README. Millisecond-precision timestamps. Bounded ring buffer (e.g. last 500 events) client-side with an export option beyond that, and a visible reconnect indicator rather than silently going stale.

## 3.4 Data Access

Reads: direct Prisma via `@iris/db`, ideally against a read replica. Writes: **none directly** — token rotation, `targetUrl` changes, deactivation all go through `iris-core-client.ts` calling Part 1's authenticated API (§0.3). Serverless deployments use a pooled connection string (PgBouncer / Prisma's serverless mode) to avoid exhausting Postgres's connection limit.

## 3.5 Auth & Authorization

Whole app gated behind the org's SSO/OIDC via `middleware.ts`. Minimum viable roles: *Viewer* (catalog, docs, event stream — no `targetUrl`, no token reveal) and *Owner/Admin* (full access, including token rotation via §3.4's write path). Every sensitive action (token revealed, rotated, `targetUrl` changed) audit-logged. Session cookies `httpOnly`/`secure`/`sameSite=strict`.

## 3.6 Testing, CI/CD, Observability

Component tests for `api-explorer` (malformed `schema` shapes) and `event-terminal` (ring-buffer eviction). Playwright E2E: catalog pagination, docs render + curl-copy correctness (including the header placeholder), invalid `appId` → custom 404, Viewer role cannot reach `targetUrl` or token reveal. `axe-core` accessibility checks in CI. Client error tracking (e.g. Sentry) focused on SSE reconnect paths — the failure mode most likely to be invisible in manual testing.

## 3.7 Definition of Done — Part 3

- [ ] Every route and every copyable string uses `appId`, never the raw token (§0.1) — including the curl example, which now shows the header separately.
- [ ] No direct portal writes to `Application`/`Route`/`EventOutbox` — verified by code review, not just documented intent.
- [ ] `@iris/db` consumed, not hand-copied (§0.3).
- [ ] Event stream survives a RabbitMQ restart with a visible reconnect state and automatic recovery.
- [ ] Viewer-role restrictions verified by E2E test, not just implemented.

---

# PART 4 — ECOSYSTEM DEFINITION OF DONE

- [ ] All three repos agree on `appId` vs. token usage exactly as in §0.1 — a grep for `:token` in any URL-construction code across all three repos should return nothing.
- [ ] `RouteSchema` and `PublishPayload` (§0.4) are implemented identically in `iris-core`'s Zod schemas and `@sugity/iris-node`'s TypeScript types.
- [ ] SDK's `init()` calls `/ingress/whoami`; `/healthz`/`/readyz` remain unauthenticated infra probes.
- [ ] `@iris/db` exists and is the only place `schema.prisma` is defined.
- [ ] An end-to-end smoke test exists somewhere (even a manual runbook step, if not automated yet): register a route via the SDK against a running `iris-core`, confirm it's visible in `iris-portal`'s docs view, publish an event, confirm it appears in the portal's event stream.# SYSTEM INSTRUCTION: IRIS ECOSYSTEM — UNIFIED PRODUCTION ENGINEERING SPECIFICATION

You are a Principal Software Engineer responsible for the full "Iris" ecosystem: `iris-core` (the gateway), `@sugity/iris-node` (the SDK), and `iris-portal` (the dashboard). These are three separate repositories, but they share data models and network contracts, and this document is the single source of truth for both. **Read Part 0 in full before touching any of Parts 1–3** — it exists specifically because building these three services from separately-written specs produced real inconsistencies (a secret credential exposed in URLs, a health-check endpoint one service called and another never defined, a data field one service assumed and another never sent). Part 0 is what makes the three repos actually interoperate; Parts 1–3 are the per-service implementation detail.

**If instead you're asked to connect a client app to an already-running Iris ecosystem** (not build the ecosystem itself), go straight to **Part 0.5** — it covers setup, the token requirement, and per-stack installation guides for that job.

**Recommended build order:** Part 1 (`iris-core`) and put it on 'STEP1' folder first — it owns the database schema and the endpoints the other two depend on. Part 2 (`@sugity/iris-node`) and put it on 'STEP2' folder second — it only needs the gateway's ingress/handshake endpoints to exist. Part 3 (`iris-portal`) and put it on 'STEP3' folder last — it depends on both the shared schema package from Part 1 and, indirectly, on real route data having been registered by an app using the Part 2 SDK.

---

# PART 0.5 — GETTING STARTED: INTEGRATING A CLIENT APP

> This part governs a different job than Parts 1–3: it's for when you (the agent) are asked to connect **someone else's application** (e.g. "Henkaten", or any client microservice) to an *already-running* Iris ecosystem, rather than building `iris-core`/`@sugity/iris-node`/`iris-portal` from scratch. Read this part before writing any client-side integration code. It follows the same setup → guide → troubleshooting flow as `docs.md`.

## 0.5.1 Architecture at a Glance

```mermaid
sequenceDiagram
    participant C as Client App (e.g. Henkaten)
    participant G as Iris Gateway (iris-core)
    participant P as Iris Portal

    Note over C,G: 1. SDK Registration (Startup / CLI)
    C->>G: POST /ingress/register (Bearer Token) + Route Schema
    G-->>C: 200 Accepted (Stored in DB)

    Note over C,G: 2. Async Event Publishing
    C->>G: POST /ingress/publish (Bearer Token) + Payload
    G-->>C: 202 Accepted (Added to Outbox)

    Note over G,P: 3. Portal Dashboard
    P->>G: Reads Application/Route/EventOutbox directly via @iris/db (Prisma, §0.3) — not an unauthenticated HTTP call
    P->>User: Renders API docs & Event terminal
```

- **`iris-core`** is the central gateway — single source of truth for the database (Postgres, §1.3) and RabbitMQ.
- **Client SDKs** (PHP or JS/Node) live inside the client app. They never touch the database directly; they only speak HTTP to `/ingress/*` using the app's bearer token (§0.1).
- **`iris-portal`** reads `Application`/`Route`/`EventOutbox` directly against `@iris/db` (§0.3) — it does not hit an unauthenticated gateway endpoint for this, correcting an earlier draft of this diagram that implied otherwise.

## 0.5.2 Zero-Config Discovery: Current Status

> **⚠️ NOT YET PART OF THIS SPEC.** A fully zero-config flow — client app boots, generates a keypair, hits a one-time provisioning slug at something like `POST /ingress/handshake`, and receives a token with no human copy-paste — is a plausible future direction, but Part 1 of this spec does **not** define a `/ingress/handshake` endpoint, and no such flow exists.
>
> **What actually happens today:** a human creates the `Application` (via the Portal's "+ New Application" or an admin script), which generates the `IRIS_PROJECT_TOKEN`. That token is then pasted into the client app's `.env` as `IRIS_PROJECT_TOKEN`. There is no automatic way for an agent to obtain this token on the client app's behalf — see §0.5.3.

## 0.5.3 MANDATORY — Confirm the Token Before Writing Integration Code

**This rule is non-negotiable and applies to every client-integration task ("add Iris to this project," "wire up the SDK," etc.):**

1. Check whether `IRIS_PROJECT_TOKEN` is already available: either given explicitly in the user's message, or present in a `.env` file you can read in the project.
2. If it is present in either place, proceed with integration using that value.
3. If it is **not** present in either place, **stop and ask the user for it** before writing or running any integration code. Tell them to get it from the Iris Portal: **+ New Application** → name the app → copy the secret token shown on screen (shown exactly once, per Step 0 below) → provide it to you, or have them paste it into their own `.env`.
4. Never invent, guess, or silently scaffold code around a placeholder value (e.g. `your_token_here`) as if it were a real token, and never fabricate one. Code that ships with a fake token fails at `init()`/`syncRoutes()`/`publish()` with `401 INVALID_TOKEN`, which is a worse outcome than asking up front.
5. **Exception:** this rule doesn't apply when the task is building the infrastructure itself (Parts 1–3) — there's no token to check for `iris-core`, the SDK, or the portal, since those are what *issue* tokens, not consume them.

### Step 0 — Get a Token (one-time, human step)

1. Open the Iris Portal → **+ New Application**.
2. Enter a name (e.g. `my-billing-service`) and the app's local URL (e.g. `http://localhost:4000`) — this becomes `targetUrl` (§1.3, validated against `ALLOWED_TARGET_CIDRS`).
3. Copy the secret token shown on screen — it is shown exactly once.
4. Store it as `IRIS_PROJECT_TOKEN` in the client app's environment.

## 0.5.4 Installation Guide — PHP / Laravel

The PHP SDK is a single, zero-dependency file (`Iris.php`) — no Composer package.

1. Copy `Iris.php` into the Laravel app (e.g. `app/Services/Iris.php`).
2. Register it via a Service Provider (`app/Providers/IrisServiceProvider.php`).

**`.env`:**
```env
IRIS_PROJECT_TOKEN=your_generated_token_here
IRIS_GATEWAY_URL=http://localhost:3001
```

**Route sync — `php artisan iris:sync`:** In Laravel 11, routing files load *after* Service Providers boot, and syncing on every `boot()` would add 100ms+ to every request — so routes are **not** synced automatically. Use the artisan command instead:
```bash
php artisan iris:sync
```
It loads the framework, extracts routes via `Route::getRoutes()`, normalizes them into the `RouteSchema` shape (§0.4), and makes a single `POST /ingress/register` call using the `.env` token. It does not cache schemas locally or re-issue tokens — it just pushes current state. Run it manually when routes change, or wire it into CI/CD on deploy.

**Publishing an event:**
```php
use App\Services\Iris;

public function completeOrder(Iris $iris) {
    // Process order...
    $iris->publish('order_completed', ['order_id' => 123]);
}
```

## 0.5.5 Installation Guide — JS / Node

```bash
npm install @sugity/iris-node
```

**`.env`:**
```env
IRIS_PROJECT_TOKEN=your_generated_token_here
IRIS_GATEWAY_URL=http://localhost:3001
```

Long-running Node apps (Express, Fastify) build their route trees synchronously at startup, so the JS SDK ships framework-specific discovery wrappers (§2.4 Flow B) that hook into this:

```typescript
import express from 'express';
import { Iris } from '@sugity/iris-node';
import { registerExpressApp } from '@sugity/iris-node/express';

const iris = new Iris(); // picks up IRIS_PROJECT_TOKEN automatically
const app = express();

app.get('/api/users', (req, res) => res.send([]));

app.listen(3000, async () => {
    await iris.init();                     // validates token against /ingress/whoami, §0.2
    await registerExpressApp(iris, app);    // auto-discovers Express stack, POSTs to /ingress/register
});
```

`registerExpressApp` walks the internal `app._router.stack`, pulls out defined paths/methods, normalizes regex paths, and syncs them to the gateway (§2.4 Flow B has the full contract, including the fallback-to-empty-set behavior on unrecognized shapes).

**Publishing an event:**
```typescript
app.post('/api/checkout', async (req, res) => {
    // publish() falls back to a bounded in-memory queue if the gateway is down — §2.4 Flow C
    await iris.publish({ event: 'checkout_started', data: req.body });
    res.send('ok');
});
```

## 0.5.6 Troubleshooting & Maintenance

**1. Route count shows 0 in portal (PHP/Laravel)**
- *Cause:* `$iris->syncRoutes()` was called inside a Service Provider's `boot()` in Laravel 11.
- *Fix:* Use `php artisan iris:sync` — the routes don't exist yet when `boot()` runs.

**2. "Failed to connect to iris-core [401]" in Portal**
- *Cause:* A zombie Node process is still running on the gateway's port, intercepting requests with stale code.
- *Fix:* Kill the stale process on that port and restart the gateway.

**3. "Unauthorized: invalid token" during `iris:sync` or `iris.init()`**
- *Cause:* `IRIS_PROJECT_TOKEN` doesn't match any `Application.tokenHash` in the gateway's database (§1.3).
- *Fix:* Confirm the gateway is pointed at the right `DATABASE_URL`, or generate a new token via the Portal and update `.env`. Never try to fix this by hardcoding or guessing a token — re-confirm per §0.5.3.

**4. Prisma "Can't reach database server"**
- *Cause:* The local Postgres instance isn't running (e.g. after a machine restart).
- *Fix:* Start the database service; no other config changes needed.

---

# PART 0 — ECOSYSTEM-WIDE CONTRACTS

## 0.1 Two Identifiers, Not One

Every `Application` has two distinct identifiers with different sensitivity levels. Conflating them was the single biggest issue found when the three phases were designed independently — the gateway's proxy path used the secret token as a URL segment, and the portal (correctly) tried to avoid doing that for its own pages but had nothing else to route on.

* **`Application.id`** (`cuid`) — non-secret. Used in **every** URL across all three services: the gateway's proxy path (`/app/:appId/api/*`), every portal page (`/app/[appId]/...`), and any copy-paste `curl` example. Treat it like a username — identifying, not secret. Safe in browser history, logs, and shared links.
* **The bearer token** — secret. Shown to the developer exactly once, at creation. Stored only as an Argon2id hash (`tokenHash`) plus a short `tokenPrefix` for fast candidate lookup — never stored or logged in plaintext. Used **only** inside an `Authorization: Bearer <token>` header, for:
  1. Invoking the gateway's own reverse proxy (`/app/:appId/api/*`)
  2. `POST /ingress/register`
  3. `POST /ingress/publish`
  4. `GET /ingress/whoami` (§0.2)

  Never placed in a URL, a query string, or any string a UI renders as one-click-copyable by default.

This means the gateway's proxy endpoint is **not** `/app/:token/api/*` as a first-draft design might assume — it's `/app/:appId/api/*`, and the handler must additionally require and verify an `Authorization` header. Getting the secret out of the portal's URLs only matters if the underlying gateway invocation also doesn't require it in a URL — fix it once, at the gateway, and both problems disappear together.

## 0.2 Endpoints: Infra Probes vs. Authenticated Handshake

Two different needs were conflated in early drafts of this spec ("ping `/api/health` to verify the token") — a liveness probe and a per-app credential check are not the same thing and shouldn't share an endpoint:

* `GET /healthz` — liveness only. No auth, no dependency checks. For the orchestrator.
* `GET /readyz` — readiness. No auth. Reports Postgres and RabbitMQ connectivity. For the orchestrator.
* `GET /ingress/whoami` — **authenticated** (`Authorization: Bearer <token>` required). Returns `{ id, name, isActive }` on success, `401` on missing/invalid token. **This is what the SDK's `init()` calls**, not `/healthz` — a bare liveness check can't tell a developer whether their token is actually valid, which is the thing `init()` is supposed to confirm.

## 0.3 One Schema, One Owner

`iris-core` owns `prisma/schema.prisma` and all migrations. It's published as an internal shared package, `@iris/db` (schema + generated client), consumed by both `iris-core` and `iris-portal`. **No repository hand-copies or "mirrors" the schema file.** Two independently maintained copies of the same schema will drift, and if two codebases can each independently write `tokenHash` or `targetUrl`, the validation/hashing/audit-logging logic for those fields has to be correct in two places instead of one — that's not a hypothetical risk, it's just a matter of time.

Corollary: **`iris-portal` does not write to `Application`, `Route`, or `EventOutbox` directly.** It reads directly (ideally against a read replica). All mutations — token rotation, `targetUrl` changes, app deactivation — go through `iris-core`'s own authenticated API, so the SSRF allowlist check on `targetUrl` (§1, Flow A) and the token-hashing logic can't be bypassed by a second write path that forgot to reimplement them.

## 0.4 Event & Route Contracts (shared types)

These are the literal shapes that cross the wire between the SDK and the gateway, and between the gateway's database and the portal's display layer. Implement them identically in both TypeScript codebases (`iris-core`'s Zod schemas and `@sugity/iris-node`'s exported types) — don't let them drift into "close enough."

```typescript
// POST /ingress/publish body — sent by the SDK, accepted by the gateway
interface PublishPayload<T = unknown> {
  event: string;
  data: T;
  idempotencyKey?: string; // SDK always sends one (auto-generated); gateway treats it as optional
                            // at the API boundary so the endpoint isn't SDK-only, but stores it on
                            // EventOutbox.idempotencyKey (unique) to dedupe retried publishes.
}

// POST /ingress/register body — sent by the SDK, stored by the gateway, rendered by the portal
interface RouteSchema {
  path: string;
  method: string;
  description?: string;
  schema?: Record<string, unknown>; // JSON-Schema-ish shape of the expected request payload.
  // NOTE: an earlier SDK draft omitted this field entirely, even though the gateway's `Route.schema`
  // column existed for it and the portal's docs view was written assuming it would be populated.
  // The field must exist in the SDK's public type or the portal has nothing to render there — best-effort/
  // optional on the SDK caller's part, but present in the contract.
}
```

## 0.5 Shared Error Envelope

Every gateway API response — including ones the SDK and portal need to parse — uses this shape:

```json
{ "error": { "code": "APPLICATION_NOT_FOUND", "message": "...", "requestId": "b3f1..." } }
```

## 0.6 Shared Config Conventions

* Gateway default base URL: `http://localhost:3001/` — this is the SDK's `IrisConfig.gatewayUrl` default and the base every portal `curl` example is built from.
* SDK-side env var: `IRIS_PROJECT_TOKEN`.
* Gateway-side env vars: `DATABASE_URL`, `RABBITMQ_URL`, `PORT`, `LOG_LEVEL`, `TOKEN_CACHE_TTL_MS`, `ALLOWED_TARGET_CIDRS`.

---

# PART 1 — `iris-core` (THE GATEWAY)

## 1.1 Tech Stack

Node.js 20 LTS, TypeScript strict mode, Fastify, `zod` for all runtime validation (env, request bodies), Prisma + PostgreSQL, `@fastify/http-proxy` (fallback plan: hand-rolled `undici` proxying if per-app timeout/retry needs outgrow the plugin), `amqplib` wrapped in a reconnection manager, `pino` with secret redaction, `@fastify/helmet`, `@fastify/rate-limit`, `prom-client`, `vitest` + `testcontainers` for integration tests, `@fastify/swagger` for docs.

## 1.2 Directory Architecture

```text
iris-core/
├── prisma/
│   ├── schema.prisma            # single source of truth — see §0.3
│   └── migrations/
├── src/
│   ├── config/{env.ts,rabbit.ts}
│   ├── errors/AppError.ts       # taxonomy → the §0.5 envelope
│   ├── schemas/                 # zod schemas matching §0.4 types exactly
│   ├── middleware/auth.ts       # resolves appId → Application, verifies Authorization header
│   ├── plugins/cache.ts         # token-verification LRU/TTL cache
│   ├── routes/{ingress.ts,proxy.ts,health.ts,whoami.ts}
│   ├── services/{db.ts,broker.ts,outbox.ts}
│   ├── workers/outboxWorker.ts
│   └── app.ts
├── tests/{unit,integration}/
├── docker/Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## 1.3 Database Schema

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model Application {
  id          String         @id @default(cuid())   // non-secret — see §0.1
  name        String         @unique
  targetUrl   String         // validated against ALLOWED_TARGET_CIDRS on write
  tokenHash   String         @unique                // Argon2id — see §0.1
  tokenPrefix String
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  routes      Route[]
  routeSyncs  RouteSyncLog[]
  outboxItems EventOutbox[]

  @@index([tokenPrefix])
}

model Route {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  path          String
  method        String
  description   String?
  schema        Json?       // populated per §0.4's RouteSchema.schema
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([applicationId, path, method])
  @@index([applicationId])
}

model RouteSyncLog {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  routeCount    Int
  sourceIp      String?
  syncedAt      DateTime    @default(now())

  @@index([applicationId])
}

model EventOutbox {
  id             String      @id @default(cuid())
  applicationId  String
  application    Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  event          String
  routingKey     String
  payload        Json
  idempotencyKey String?     @unique
  status         String      @default("pending")   // pending | published | failed
  attempts       Int         @default(0)
  lastError      String?
  createdAt      DateTime    @default(now())
  publishedAt    DateTime?

  @@index([status, createdAt])
}
```

Run migrations via `prisma migrate deploy` as a discrete CI/CD step — never on application boot.

## 1.4 Core Flows

### Flow A — Reverse Proxy: `/app/:appId/api/*`

1. Extract `:appId` from the path and the token from the `Authorization: Bearer <token>` header — **not** from the URL (§0.1).
2. If `Authorization` is missing or malformed, `401` immediately, before any DB lookup.
3. Look up `Application` by `id`. If not found or `isActive` is false, `404` — this is safe to be a generic 404 since `appId` isn't secret; it just means the target doesn't exist or was deactivated.
4. If found, verify the header token against `tokenHash` with a constant-time comparison (Argon2 verify). Cache successful verifications in-memory keyed by a SHA-256 of the token (not the raw token), short TTL (10–30s), documented as per-instance and therefore eventually consistent across replicas — a Phase 2/Redis-backed shared cache is a noted future improvement, not required now. Invalid token → `401`.
5. Strip hop-by-hop headers (`Connection`, `Keep-Alive`, `Transfer-Encoding`, `Upgrade`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`), inject `X-Request-Id`/`X-Forwarded-For`, stream to `targetUrl` with a bounded timeout (default 10s, configurable).
6. Distinguish `504` (upstream timeout), `502` (upstream unreachable), `500` (Iris-side error) — an on-call engineer needs to know instantly which side broke.
7. `targetUrl` is validated at registration/update time against `ALLOWED_TARGET_CIDRS` (an operator-configured internal allowlist), not a blanket private-IP block — this gateway's job is routing to internal services, so the allowlist (not a blanket rule) is what prevents a target pointing somewhere unintended.

### Flow B — SDK Ingress: `POST /ingress/register`

Validate against the `RouteSchema[]` zod schema (§0.4). Verify token as in Flow A (looked up via the resolved `Application`, not a separate token-in-URL mechanism). Replace the app's route set inside one `prisma.$transaction` (`deleteMany` + `createMany`) so a crash mid-sync never leaves a partial table. Write a `RouteSyncLog` row. Rate-limit per app (e.g. 10/min).

### Flow C — Event Publishing: `POST /ingress/publish`

Durable outbox, not fire-and-forget:

1. Validate against `PublishPayload` (§0.4).
2. Write to `EventOutbox` (`status: "pending"`) — this write is the durability guarantee, succeeding even if RabbitMQ is fully down.
3. Return `202 Accepted` once committed.
4. Background worker polls `pending` rows, publishes via a `confirmChannel` (publisher confirms — a bare `channel.publish()` doesn't guarantee broker acceptance) to the `iris.events` topic exchange, routing key `[appName].[eventName]`.
5. On failure: increment `attempts`, exponential backoff, mark `failed` after a max-attempts ceiling and log at `error` with enough context to replay manually.

### Flow D — Authenticated Handshake: `GET /ingress/whoami`

Per §0.2 — verify the `Authorization` header exactly as in Flow A, return `{ id, name, isActive }` on success. This is the endpoint the SDK's `init()` actually calls.

## 1.5 AMQP Connection Management

Reconnect with exponential backoff + jitter (capped interval, e.g. 30s). Expose connection state (`connected | reconnecting | disconnected`) for `/readyz`. Route handlers and the outbox worker never hold a channel reference directly — they ask the connection manager for the current one.

## 1.6 Security

Env validation at boot via zod (fail-fast, not `undefined` config in prod). Argon2id token hashing (§0.1). `@fastify/rate-limit` per resolved application. Body size limits on ingress endpoints. `@fastify/helmet`. `pino` redaction on `Authorization` and raw tokens. SSRF defense per Flow A step 7.

## 1.7 Observability, Resilience, Testing, CI/CD

* **Logging:** `pino`, one JSON line per request: `requestId`, `applicationId` (once resolved), method, path, status, duration.
* **Metrics** (`/metrics`): proxy latency histogram by app/status class, outbox publish success/failure counters, AMQP reconnect counter, rate-limit rejection counter.
* **Graceful shutdown:** `SIGTERM`/`SIGINT` → stop accepting connections, drain in-flight requests, close Prisma, close AMQP cleanly, bounded window for the outbox worker to finish its batch.
* **Testing:** unit tests for token verification and outbox backoff math; `testcontainers`-based integration tests covering register → route storage, publish → outbox → broker delivery (including a broker-outage-then-recovery scenario), and proxy routing against a mocked upstream.
* **CI/CD:** lint → typecheck → tests → dependency audit → build → Docker build; `prisma migrate deploy` as its own pipeline step, decoupled from app boot.

## 1.8 Definition of Done — Part 1

- [ ] Proxy path is `/app/:appId/api/*` with a required `Authorization` header — no secret token anywhere in a URL.
- [ ] `/ingress/whoami` implemented and distinct from `/healthz`/`/readyz`.
- [ ] Raw token shown exactly once, at creation; only `tokenHash`/`tokenPrefix` persisted.
- [ ] Broker-outage integration test passes: publish still returns `202` and the event lands in `EventOutbox`, then gets published once RabbitMQ recovers.
- [ ] `@iris/db` package published/available for `iris-portal` to consume (§0.3).

---

# PART 2 — `@sugity/iris-node` (THE SDK)

## 2.1 Tech Stack

Node.js ≥18, TypeScript strict, zero runtime dependencies (native `fetch` + `AbortController`), dual CJS/ESM build via `tsup`, Changesets for semver discipline, `vitest` + `undici`'s `MockAgent` (dev-only) for tests.

## 2.2 Directory Architecture

```text
iris-node-sdk/
├── src/
│   ├── core/{client.ts,httpClient.ts,queue.ts,errors.ts,types.ts}
│   ├── discovery/{express.ts,fastify.ts,shared.ts}   # subpath exports — see §2.5
│   └── index.ts                                        # exports only `Iris`, types, errors
├── tests/{unit,fixtures}/
├── examples/{express,fastify}/
└── .github/workflows/ci.yml
```

## 2.3 Core Types

```typescript
export interface IrisConfig {
  projectToken: string;
  gatewayUrl?: string;                 // default per §0.6
  environment?: 'development' | 'production';
  timeoutMs?: number;                  // default 5000
  retry?: { maxAttempts?: number; baseDelayMs?: number }; // default 3 / 200ms, exp backoff + jitter
  maxQueueSize?: number;               // default 1000
  onQueueFull?: 'drop-oldest' | 'reject-newest';
  failOnInitError?: boolean;           // default false — see Flow A
}

export type RouteSchema = /* exactly §0.4's RouteSchema, including `schema` */;
export type PublishPayload<T = unknown> = /* exactly §0.4's PublishPayload */;

export interface PublishResult {
  status: 'sent' | 'queued' | 'dropped' | 'failed';
  idempotencyKey: string;
}
```

## 2.4 Core Flows

### Flow A — Initialization (`Iris` class — public name, resolving the `IrisClient`/`Iris` naming conflict in an earlier draft)

* **Constructor (sync, throws on programmer error only):** resolve `projectToken` from explicit config or `IRIS_PROJECT_TOKEN`; throw `IrisConfigError` immediately if missing/malformed, naming the exact fix. No network call in the constructor.
* **`init()` (async, environment-tolerant by default):** calls `GET /ingress/whoami` (§0.2 — not a generic health check) with the configured timeout. On failure, emit `'init:error'` and resolve anyway by default (a transient gateway outage at boot must not crash an unrelated host app); reject instead only if `failOnInitError: true` (useful for a CI/deploy-time smoke test that should fail loudly).

### Flow B — Auto-Discovery (`src/discovery/express.ts`, `src/discovery/fastify.ts`)

* Express: walking `app._router.stack` touches an internal, version-fragile structure — wrap the whole walk in `try/catch`, recursively descend nested routers, skip/normalize regex-only paths, dedupe `(path, method)` pairs, and on any unrecognized shape emit `'discovery:warning'` and return an empty set rather than throwing.
* Fastify: use the `onRoute` hook — a stable public API, structurally more reliable than the Express approach.
* Idempotent on repeat calls (e.g. dev-mode hot reload shouldn't duplicate registrations).
* `syncRoutes()` posts the normalized `RouteSchema[]` (§0.4, including `schema` where the caller supplied one) to `/ingress/register`, capped at a low retry count (e.g. 1) so a failed doc sync doesn't delay app startup.

### Flow C — Event Publishing (`Iris.publish()`)

Accepts `PublishPayload<T>`; auto-generates `idempotencyKey` via `crypto.randomUUID()` if omitted (§0.4). Attempts immediate send with a timeout; retries transient failures (network error, timeout, 5xx) with exponential backoff + jitter up to `retry.maxAttempts` — **never retries 4xx**. On exhausted retries, falls into a bounded in-memory queue (`maxQueueSize`, `onQueueFull` policy) rather than growing unbounded, emitting `'queue:full'` when it happens. Returns `Promise<PublishResult>`; callers may fire-and-forget or await. `iris.flush()` (or an internal `SIGTERM` handler) makes a best-effort attempt to drain the queue on shutdown.

## 2.5 Observability, DX Contract, Packaging

`Iris` extends Node's built-in `EventEmitter` (core, not a dependency): `init:error`, `publish:success`, `publish:retry`, `publish:failed`, `queue:full`, `discovery:warning`.

```javascript
import express from 'express';
import { Iris } from '@sugity/iris-node';
import { registerExpressApp } from '@sugity/iris-node/express';

const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN });
const app = express();

app.post('/api/absence', (req, res) => {
  iris.publish({ event: 'absence_updated', data: req.body }); // fire-and-forget is fine
  res.send('Success');
});

app.listen(3000, async () => {
  await iris.init();
  await registerExpressApp(iris, app);
});
```

Framework integrations live in separate subpath exports (`/express`, `/fastify`) so the core client stays framework-agnostic and a Fastify-only consumer never bundles Express-sniffing code. `package.json` `exports` map covers root + both subpaths with `types`/`import`/`require` conditions; `sideEffects: false`; `files` limited to `dist/`.

## 2.6 Testing & CI/CD

Unit tests (mocked `fetch`, fake timers) for retry/backoff timing, 4xx-never-retries, queue backpressure. Discovery fixture tests for nested/regex Express routes and Fastify's `onRoute`, asserting `discovery:warning` fires on malformed input rather than throwing. A CI step that actually `require()`s the CJS build and `import`s the ESM build to catch `exports`-map misconfiguration. Matrix-tested on Node 18/20/22; releases via Changesets with npm provenance.

## 2.7 Definition of Done — Part 2

- [ ] `init()` calls `/ingress/whoami`, not a generic health endpoint.
- [ ] Constructor throws only on config problems; `init()` never throws unless `failOnInitError: true`.
- [ ] `RouteSchema` includes `schema?: Record<string, unknown>` (§0.4).
- [ ] `publish()` retries transient failures, skips 4xx, falls back to a bounded queue with an observable backpressure event.
- [ ] `exports` map verified by an actual CJS+ESM smoke test in CI.

---

# PART 3 — `iris-portal` (THE DASHBOARD)

## 3.1 Tech Stack

Next.js 14+ (App Router), TypeScript strict, Tailwind + Shadcn UI, `@tanstack/react-table` (server-side pagination/sorting) + `@tanstack/react-virtual` for the event terminal, Lucide React, SSO/OIDC auth.

## 3.2 Directory Architecture

```text
iris-portal/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # Service Catalog
│   │   └── app/[appId]/                   # §0.1 — never [token]
│   │       ├── page.tsx
│   │       ├── not-found.tsx
│   │       ├── docs/page.tsx
│   │       └── events/{page.tsx,stream/route.ts}
│   ├── components/{ui,api-explorer.tsx,event-terminal.tsx,token-reveal-dialog.tsx}
│   ├── lib/{db.ts,iris-core-client.ts,auth.ts,permissions.ts}
│   └── middleware.ts
├── tests/{unit,e2e}/
└── .github/workflows/ci.yml
```

Note: **no `prisma/schema.prisma` in this repo** — it depends on the `@iris/db` package from Part 1 (§0.3).

## 3.3 Core Views

### View A — Service Catalog (`/`)

Header metrics (apps, routes, throughput — sourced from the same `/metrics` as Part 1, not recomputed independently). Server-paginated table of `Application` rows; row click → `/app/[appId]`.

### View B — API Explorer (`/app/[appId]/docs`)

Query `Application` by `id` (§0.1) with its `Route`s. Group by HTTP method with color **and** a text label (accessibility — color alone isn't sufficient). Render `description`/`schema` through React's default escaping — both originate from third-party SDK calls (§0.4) and must never go through `dangerouslySetInnerHTML`. Filter state lives in the URL query string. **"Copy curl" now includes the auth header, not just the URL** (per §0.1's Flow A change):

```bash
curl -X POST http://localhost:3001//app/{appId}/api/path \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

The `<YOUR_TOKEN>` placeholder is deliberate — the button copies the shareable part only; an authorized user fetches their own real token separately via the token-reveal dialog (§3.5), never bundled into a copyable string alongside the URL.

### View C — Real-Time Event Stream (`/app/[appId]/events`)

A single process (living inside `iris-core` or as its own small service) maintains one AMQP consumer on `iris.events` and fans events out over Server-Sent Events to `/app/[appId]/events/stream`. If the portal is deployed serverless, this fan-out must live in the separate service, not in a per-request/per-instance AMQP connection (a connection storm waiting to happen) — state the deployment assumption explicitly in the README. Millisecond-precision timestamps. Bounded ring buffer (e.g. last 500 events) client-side with an export option beyond that, and a visible reconnect indicator rather than silently going stale.

## 3.4 Data Access

Reads: direct Prisma via `@iris/db`, ideally against a read replica. Writes: **none directly** — token rotation, `targetUrl` changes, deactivation all go through `iris-core-client.ts` calling Part 1's authenticated API (§0.3). Serverless deployments use a pooled connection string (PgBouncer / Prisma's serverless mode) to avoid exhausting Postgres's connection limit.

## 3.5 Auth & Authorization

Whole app gated behind the org's SSO/OIDC via `middleware.ts`. Minimum viable roles: *Viewer* (catalog, docs, event stream — no `targetUrl`, no token reveal) and *Owner/Admin* (full access, including token rotation via §3.4's write path). Every sensitive action (token revealed, rotated, `targetUrl` changed) audit-logged. Session cookies `httpOnly`/`secure`/`sameSite=strict`.

## 3.6 Testing, CI/CD, Observability

Component tests for `api-explorer` (malformed `schema` shapes) and `event-terminal` (ring-buffer eviction). Playwright E2E: catalog pagination, docs render + curl-copy correctness (including the header placeholder), invalid `appId` → custom 404, Viewer role cannot reach `targetUrl` or token reveal. `axe-core` accessibility checks in CI. Client error tracking (e.g. Sentry) focused on SSE reconnect paths — the failure mode most likely to be invisible in manual testing.

## 3.7 Definition of Done — Part 3

- [ ] Every route and every copyable string uses `appId`, never the raw token (§0.1) — including the curl example, which now shows the header separately.
- [ ] No direct portal writes to `Application`/`Route`/`EventOutbox` — verified by code review, not just documented intent.
- [ ] `@iris/db` consumed, not hand-copied (§0.3).
- [ ] Event stream survives a RabbitMQ restart with a visible reconnect state and automatic recovery.
- [ ] Viewer-role restrictions verified by E2E test, not just implemented.

---

# PART 4 — ECOSYSTEM DEFINITION OF DONE

- [ ] All three repos agree on `appId` vs. token usage exactly as in §0.1 — a grep for `:token` in any URL-construction code across all three repos should return nothing.
- [ ] `RouteSchema` and `PublishPayload` (§0.4) are implemented identically in `iris-core`'s Zod schemas and `@sugity/iris-node`'s TypeScript types.
- [ ] SDK's `init()` calls `/ingress/whoami`; `/healthz`/`/readyz` remain unauthenticated infra probes.
- [ ] `@iris/db` exists and is the only place `schema.prisma` is defined.
- [ ] An end-to-end smoke test exists somewhere (even a manual runbook step, if not automated yet): register a route via the SDK against a running `iris-core`, confirm it's visible in `iris-portal`'s docs view, publish an event, confirm it appears in the portal's event stream.
