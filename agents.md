# SYSTEM INSTRUCTION: IRIS ECOSYSTEM — UNIFIED PRODUCTION ENGINEERING SPECIFICATION

You are a Principal Software Engineer responsible for the full "Iris" ecosystem: `iris-core` (the gateway), `@sugity/iris-node` (the Node SDK), `Iris.php` (the PHP SDK), and `iris-portal` (the dashboard). These are three separate repository folders (`STEP1`, `STEP2`, `STEP3`), but they share data models and network contracts, and **this document is the single source of truth for all of them.** Read Part 0 in full before touching any of Parts 1–4 — it defines the contracts that make all three repos interoperate.

**Recommended build order:** Part 1 (`iris-core` in `STEP1/`) first — it owns the database schema and all endpoints the other two depend on. Part 2 (`@sugity/iris-node` in `STEP2/`) second — it only needs the gateway's ingress endpoints. Part 3 (`iris-portal` in `STEP3/iris-portal/`) last — it depends on STEP1's admin API being live.

---

# PART 0 — ECOSYSTEM-WIDE CONTRACTS

## 0.1 Two Identifiers, Not One

Every `Application` has two distinct identifiers with different sensitivity levels:

* **`Application.id`** (`cuid`) — non-secret. Used in every URL across all three services: the gateway's proxy path (`/app/:appId/api/*`), every portal page (`/app/[appId]/...`), and any `curl` example. Treat it like a username — identifying, not secret.
* **The bearer token** — secret. Shown to the developer exactly once, at creation. Stored only as an Argon2id hash (`tokenHash`) plus a short `tokenPrefix` (first 8 chars) for fast candidate lookup — never stored or logged in plaintext. Used **only** inside `Authorization: Bearer <token>` headers for:
  1. `POST /ingress/register`
  2. `POST /ingress/publish`
  3. `GET /ingress/whoami`
  4. Reverse proxy: `GET|POST|... /app/:appId/api/*`

  Never placed in a URL, query string, or rendered as copyable text by default.

Token lookup strategy: extract the first 8 chars as prefix → `findMany({ tokenPrefix: prefix, isActive: true })` → `argon2.verify()` against each candidate. This avoids a full-table scan without storing the raw token.

## 0.2 Endpoints: Infra Probes vs. Authenticated Handshake

* `GET /healthz` — liveness only. No auth, no dependency checks. Returns `{ status: "ok" }`.
* `GET /readyz` — readiness. No auth. Reports MySQL and RabbitMQ connectivity. Returns `{ status: "ok", db: "ok", broker: "ok" }`.
* `GET /ingress/whoami` — **authenticated** (`Authorization: Bearer <token>` required). Returns `{ id, name, isActive }` on success, `401` on missing/invalid token. **This is what the SDK's `init()` calls** — not `/healthz`. A bare liveness check can't tell a developer whether their token is valid.

## 0.3 Admin API — Portal Writes Through iris-core

`iris-portal` does NOT write to MySQL directly. All mutations go through `iris-core`'s `/admin/*` endpoints, guarded by `X-Iris-Admin-Key` header. This ensures token-hashing logic and SSRF allowlist checks can't be bypassed.

Admin routes implemented:
- `POST /admin/applications` — create app, return token plaintext once
- `GET /admin/applications` — list all (for Service Catalog)
- `GET /admin/applications/:id` — single app with routes + last 5 sync logs
- `PATCH /admin/applications/:id` — update `targetUrl` or `isActive`
- `POST /admin/applications/:id/rotate-token` — rotate token, return new token once, evict cache
- `GET /admin/applications/:id/events` — paginated outbox events (cursor-based)

## 0.4 Event & Route Contracts (shared types)

```typescript
// POST /ingress/publish body
interface PublishPayload<T = unknown> {
  event: string;
  data: T;
  idempotencyKey?: string; // SDK auto-generates via crypto.randomUUID() if omitted
                            // stored with @unique constraint — gateway dedupes on P2002
}

// POST /ingress/register body (array)
interface RouteSchema {
  path: string;
  method: string;
  description?: string;
  schema?: Record<string, unknown>; // JSON-Schema-ish request shape, rendered by portal
}
```

## 0.5 Shared Error Envelope

Every gateway API response uses:

```json
{ "error": { "code": "APPLICATION_NOT_FOUND", "message": "...", "requestId": "b3f1..." } }
```

## 0.6 Shared Config Conventions

| Variable | Where | Default | Notes |
|----------|-------|---------|-------|
| `IRIS_PROJECT_TOKEN` | Client app `.env` | — | Token for SDK auth |
| `IRIS_GATEWAY_URL` | Client app `.env` | `http://localhost:3001` | SDK default |
| `IRIS_CORE_URL` | `STEP3/.env.local` | `http://localhost:3001` | Portal → gateway base |
| `IRIS_ADMIN_KEY` | STEP1 `.env` + STEP3 `.env.local` | — | Must match exactly |
| `JWT_SECRET` | STEP3 `.env.local` | — | Portal session JWT signing |
| `DATABASE_URL` | STEP1 `.env` | — | **MySQL** (`provider = "mysql"`) |
| `RABBITMQ_URL` | STEP1 `.env` | `amqp://guest:guest@localhost:5672/` | Outbox broker |
| `TOKEN_CACHE_TTL_MS` | STEP1 `.env` | `15000` | In-process token verification cache TTL |
| `ALLOWED_TARGET_CIDRS` | STEP1 `.env` | private ranges | SSRF allowlist for `targetUrl` |
| `EVENT_RETENTION_DAYS` | STEP1 `.env` | `90` | Outbox worker purge threshold |
| `METRICS_KEY` | STEP1 `.env` | (unset) | If set, `/metrics` requires `Authorization: Bearer <value>` |

---

# PART 1 — `iris-core` (THE GATEWAY) — `STEP1/`

## 1.1 Tech Stack

Node.js 20 LTS, TypeScript strict, **Fastify 4**, `zod` for all runtime validation, **Prisma 5 + MySQL** (XAMPP in dev), `amqplib` with reconnection manager, `argon2` (Argon2id), `pino` with `Authorization` redaction, `@fastify/helmet`, `@fastify/rate-limit` (global 100/min), `prom-client`, `undici` (proxy), `@fastify/swagger` + `@fastify/swagger-ui`, `vitest`.

## 1.2 Directory Architecture (Actual)

```text
STEP1/
├── prisma/
│   ├── schema.prisma            # provider = "mysql" — single source of truth
│   └── migrations/
├── src/
│   ├── app.ts                   # Fastify instance, plugin registration, lifecycle
│   ├── config/env.ts            # zod env validation, isAllowedTarget()
│   ├── errors/AppError.ts       # AppError class + Errors factory → §0.5 envelope
│   ├── schemas/ingress.ts       # RegisterPayload (RouteSchema[]), PublishPayload zod schemas
│   ├── middleware/auth.ts       # generateToken(), verifyToken(), invalidateApp() (in-process cache)
│   ├── routes/
│   │   ├── health.ts            # GET /healthz, GET /readyz
│   │   ├── whoami.ts            # GET /ingress/whoami
│   │   ├── ingress.ts           # POST /ingress/register, POST /ingress/publish
│   │   ├── proxy.ts             # /app/:appId/api/* reverse proxy (undici)
│   │   ├── admin.ts             # /admin/* CRUD + token rotation + events
│   │   └── securityAudit.ts     # /security/* audit endpoints
│   ├── services/
│   │   ├── db.ts                # PrismaClient singleton
│   │   └── broker.ts            # amqplib connection manager (reconnect w/ backoff)
│   └── workers/outboxWorker.ts  # polls EventOutbox, publishes to RabbitMQ topic exchange
├── package.json
└── .env / .env.example
```

## 1.3 Database Schema (Actual — MySQL)

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client { provider = "prisma-client-js" }

model Application {
  id          String         @id @default(cuid())
  name        String         @unique
  targetUrl   String
  tokenHash   String         @unique                // Argon2id
  tokenPrefix String                                // first 8 chars of raw token
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
  schema        Json?
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
  routingKey     String                             // format: "<appName>.<eventName>"
  payload        Json
  idempotencyKey String?     @unique
  status         String      @default("pending")   // pending | published | failed
  attempts       Int         @default(0)
  lastError      String?
  createdAt      DateTime    @default(now())
  publishedAt    DateTime?
  @@index([status, createdAt])
}

// Portal user system
enum Role { SUPER_ADMIN  ADMIN  DEVELOPER }
enum UserStatus { PENDING  ACTIVE  REJECTED }

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  firstName    String
  middleName   String?
  role         Role       @default(DEVELOPER)
  status       UserStatus @default(PENDING)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

> **Note:** The `User` model exists in the gateway schema to support the portal's built-in auth system (register/login/approval flow). This is simpler than running a separate auth service.

## 1.4 Core Flows

### Flow A — Reverse Proxy: `/app/:appId/api/*`

1. Extract `:appId` from path. Extract token from `Authorization: Bearer <token>`.
2. If `Authorization` missing/malformed → `401` immediately, before any DB lookup.
3. Look up `Application` by `id`. If not found or `isActive` false → `404`.
4. Verify header token against `tokenHash` via Argon2 verify. Cache successful verifications in-memory (keyed by SHA-256 of token, TTL = `TOKEN_CACHE_TTL_MS`). Invalid → `401`.
5. Strip hop-by-hop headers, inject `X-Request-Id` / `X-Forwarded-For`, stream to `targetUrl` via `undici` with bounded timeout (10s default).
6. `targetUrl` validated against `ALLOWED_TARGET_CIDRS` at create/update time.

### Flow B — Route Registration: `POST /ingress/register`

1. Verify token (prefix lookup + Argon2 verify).
2. Validate body as `RouteSchema[]` via zod.
3. Deduplicate `(path, method)` pairs client-side before insert.
4. Replace app's route set in one `prisma.$transaction` (`deleteMany` + `createMany`) — crash-safe, never partial.
5. Write `RouteSyncLog` row with `routeCount` and `sourceIp`.
6. Return `{ status: "ok", routeCount: N }`.

### Flow C — Event Publishing: `POST /ingress/publish`

1. Verify token.
2. Validate body as `PublishPayload` via zod.
3. Auto-generate `idempotencyKey = crypto.randomUUID()` if omitted.
4. Write `EventOutbox` row (`status: "pending"`). On `P2002` (duplicate key) → silently accept (idempotent).
5. Return `202 Accepted` with `{ status: "accepted", idempotencyKey }`.
6. Background `outboxWorker` polls `pending` rows, publishes to `iris.events` topic exchange, routing key `<appName>.<eventName>`, via publisher confirms (`confirmChannel`). On failure: increment `attempts`, exponential backoff, mark `failed` after ceiling.

### Flow D — Token Verification: `GET /ingress/whoami`

Verify `Authorization` header as in Flow A. Return `{ id, name, isActive }`. This is the SDK's `init()` target.

## 1.5 Admin Key Guard

All `/admin/*` routes check `X-Iris-Admin-Key` header against `IRIS_ADMIN_KEY` env var. If key unset (dev), routes are open. In production, `env.ts` crashes at boot if `IRIS_ADMIN_KEY` is unset and `NODE_ENV=production`.

## 1.6 Metrics

`GET /metrics` — Prometheus metrics via `prom-client`. If `METRICS_KEY` env is set, requires `Authorization: Bearer <METRICS_KEY>`. Tracks:
- `iris_proxy_latency_seconds` histogram (labels: `appId`, `status`)
- Default Node.js process metrics

## 1.7 Security

- Argon2id token hashing — never stored/logged plaintext.
- `pino` redacts `req.headers.authorization`.
- `@fastify/helmet` on all routes.
- `@fastify/rate-limit` — 100 req/min global.
- Body limit: 10MB.
- SSRF defense: `targetUrl` validated against `ALLOWED_TARGET_CIDRS` on every write.
- In-process token cache uses SHA-256(token) as key, not raw token.

## 1.8 Lifecycle & Graceful Shutdown

`SIGTERM`/`SIGINT` → `stopOutboxWorker()` → `app.close()` → `closeBroker()` → `db.$disconnect()` → `process.exit(0)`. Force-kill after 10s via `setTimeout(..., 10_000).unref()`.

## 1.9 npm Scripts

```bash
npm run dev          # kill-port 3001 && tsx watch --env-file=.env src/app.ts
npm run build        # tsc (tsconfig.build.json)
npm run start        # node --env-file=.env dist/app.js
npm run db:migrate   # prisma migrate deploy
npm run db:generate  # prisma generate
npm run db:studio    # prisma studio
npm run test         # vitest run
npm run typecheck    # tsc --noEmit
```

## 1.10 Definition of Done — Part 1

- [x] Proxy path `/app/:appId/api/*` with required `Authorization` header — token never in URL.
- [x] `/ingress/whoami` implemented, distinct from `/healthz`/`/readyz`.
- [x] Raw token shown exactly once at creation, only `tokenHash`/`tokenPrefix` persisted.
- [x] Route replacement is transactional (deleteMany + createMany in one `$transaction`).
- [x] Outbox idempotency via `@unique idempotencyKey` — P2002 silently accepted.
- [x] Admin routes guarded by `X-Iris-Admin-Key`.
- [x] Token rotation evicts in-process cache via `invalidateApp(id)`.
- [x] MySQL schema with `User` model for portal auth.

---

# PART 2 — `@sugity/iris-node` (THE NODE SDK) — `STEP2/`

## 2.1 Tech Stack

Node.js ≥18, TypeScript strict, **zero runtime dependencies** (native `fetch` + `AbortController` + `EventEmitter` + `crypto`), dual CJS/ESM build via `tsup`, `vitest` for tests. Express and Fastify are `peerDependencies` (optional).

## 2.2 Directory Architecture (Actual)

```text
STEP2/
├── src/
│   ├── core/
│   │   ├── client.ts       # Iris class (extends EventEmitter) — public API
│   │   ├── httpClient.ts   # fetch wrapper w/ timeout, retry, 4xx-no-retry
│   │   ├── queue.ts        # BoundedQueue (drop-oldest | reject-newest)
│   │   ├── errors.ts       # IrisConfigError
│   │   └── types.ts        # IrisConfig, RouteSchema, PublishPayload, PublishResult
│   ├── discovery/
│   │   ├── express.ts      # registerExpressApp() — walks app._router.stack
│   │   ├── fastify.ts      # registerFastifyApp() — uses onRoute hook
│   │   └── shared.ts       # shared normalization helpers
│   └── index.ts            # exports Iris, types, errors
├── php/
│   └── Iris.php            # PHP/Laravel single-file SDK
├── dist/                   # built output (CJS + ESM + types)
├── package.json
└── tsup.config.ts
```

## 2.3 Core Types (Actual)

```typescript
export interface IrisConfig {
  projectToken: string;
  gatewayUrl?: string;           // default: "http://localhost:3001/"
  environment?: 'development' | 'production';
  timeoutMs?: number;            // default: 5000
  retry?: {
    maxAttempts?: number;        // default: 3
    baseDelayMs?: number;        // default: 200, exponential backoff + jitter
  };
  maxQueueSize?: number;         // default: 1000
  onQueueFull?: 'drop-oldest' | 'reject-newest';  // default: 'drop-oldest'
  failOnInitError?: boolean;     // default: false
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

export interface RouteSchema {
  path: string;
  method: string;
  description?: string;
  schema?: Record<string, unknown>;
}
```

## 2.4 Core Flows (Actual)

### `Iris` constructor

- Resolves `projectToken` from config or `process.env.IRIS_PROJECT_TOKEN`.
- Throws `IrisConfigError` immediately if missing — sync, no network.
- Creates `HttpClient` and `BoundedQueue`.

### `iris.init()`

- Calls `GET /ingress/whoami` with `Authorization: Bearer <token>`.
- On failure: emits `'init:error'` event, resolves without throwing (unless `failOnInitError: true`).

### `iris.publish(payload)`

1. Auto-generates `idempotencyKey` via `crypto.randomUUID()` if not provided.
2. Attempts immediate HTTP send via `httpClient.request()` — retries transient failures (network error, timeout, 5xx) with exponential backoff. **Never retries 4xx.**
3. On exhausted retries: enqueues into `BoundedQueue`. Returns `{ status: 'queued' }`.
4. If queue is full per `onQueueFull` policy: emits `'queue:full'`, returns `{ status: 'dropped' }`.
5. Queue drains in background via `processQueue()`. `iris.flush()` available for shutdown drain.

### `iris.syncRoutes(routes: RouteSchema[])`

- POSTs `RouteSchema[]` to `/ingress/register`.
- `retryAttempts: 1` (hard-coded) — failed doc sync must not stall app startup.
- Also aliased as `iris.registerRoutes()` for discovery packages.

### `registerExpressApp(iris, app)`

Walks `app._router.stack` recursively, normalizes regex paths, dedupes `(path, method)` pairs, emits `'discovery:warning'` on unrecognized shapes. Calls `iris.syncRoutes()`.

### `registerFastifyApp(iris, app)`

Uses `onRoute` hook (stable public API, not internal stack). Calls `iris.syncRoutes()`.

## 2.5 Events Emitted

```typescript
iris.on('init:error', (err) => { ... });
iris.on('publish:success', ({ idempotencyKey }) => { ... });
iris.on('publish:retry', ({ idempotencyKey, attempt }) => { ... });
iris.on('publish:failed', ({ idempotencyKey, error }) => { ... });
iris.on('queue:full', ({ idempotencyKey }) => { ... });
iris.on('discovery:warning', ({ message }) => { ... });
```

## 2.6 Package Exports Map (Actual)

```json
{
  ".":         { "require": "./dist/index.js", "import": "./dist/index.mjs", "types": "./dist/index.d.ts" },
  "./express": { "require": "./dist/discovery/express.js", "import": "./dist/discovery/express.mjs", "types": "./dist/discovery/express.d.ts" },
  "./fastify": { "require": "./dist/discovery/fastify.js", "import": "./dist/discovery/fastify.mjs", "types": "./dist/discovery/fastify.d.ts" }
}
```

`"sideEffects": false` — safe for tree-shaking. `"files": ["dist"]` — only dist published.

## 2.7 PHP SDK — `STEP2/php/Iris.php`

Single-file, zero dependencies. Installed by copying into the Laravel project (`app/Services/Iris.php`). Picks up `IRIS_PROJECT_TOKEN` and `IRIS_GATEWAY_URL` from Laravel's `.env` (via `env()`). Provides:
- Route sync (called via `php artisan iris:sync` — an artisan command you register in a Service Provider)
- `$iris->publish(string $event, array $data)` — fires HTTP to `/ingress/publish`

> Do not call sync in Service Provider `boot()` — Laravel 11 routes aren't loaded at that point.

## 2.8 npm Scripts

```bash
npm run build        # tsup → dist/
npm run dev          # tsup --watch
npm run test         # vitest run
npm run typecheck    # tsc --noEmit
```

## 2.9 Definition of Done — Part 2

- [x] `init()` calls `/ingress/whoami`, not a generic health endpoint.
- [x] Constructor throws only on config problems; `init()` never throws unless `failOnInitError: true`.
- [x] `RouteSchema` includes `schema?: Record<string, unknown>`.
- [x] `publish()` retries transient failures, skips 4xx, falls back to bounded queue.
- [x] Dual CJS/ESM exports map with correct `types` conditions.
- [x] `flush()` available for graceful shutdown.
- [x] `syncRoutes` / `registerRoutes` alias both work.

---

# PART 3 — `iris-portal` (THE DASHBOARD) — `STEP3/iris-portal/`

## 3.1 Tech Stack (Actual)

**Next.js 16.2.10** (App Router), **React 19**, TypeScript strict, **Tailwind CSS 4**, `jose` for JWT (custom auth, not SSO/OIDC), no Prisma in portal (reads via `iris-core-client.ts` → iris-core admin API).

> **No `@iris/db` package yet.** The portal does NOT connect to MySQL directly. It fetches all data through `iris-core`'s `/admin/*` HTTP API. This is a deliberate simplification from the original spec.

## 3.2 Directory Architecture (Actual)

```text
STEP3/iris-portal/
├── app/
│   ├── layout.tsx                    # root layout
│   ├── globals.css
│   ├── page.tsx                      # root redirect (→ /dashboard or /login)
│   ├── login/                        # login page
│   ├── daftar/                       # register page (new users → PENDING)
│   ├── queue/                        # holding page for PENDING users
│   ├── dashboard/                    # Service Catalog (list of apps)
│   ├── app/[appId]/                  # App detail — appId is the non-secret cuid
│   ├── admin/                        # Admin panel (approve/reject users)
│   └── api/auth/                     # Auth API routes (login, register, logout)
├── components/                       # UI components
├── lib/
│   ├── auth.ts                       # signJwt() / verifyJwt() via jose (HS256, 24h)
│   ├── iris-core-client.ts           # typed fetch wrapper → iris-core /admin/* API
│   └── utils.ts
├── middleware.ts                     # JWT cookie check, role routing, header injection
├── .env.local / .env.local.example
└── package.json
```

## 3.3 Auth System (Actual — Custom JWT, Not SSO)

The portal has its own user system backed by the `User` table in `iris-core`'s MySQL database (accessed via iris-core's API, not directly).

| Route | Access | Notes |
|-------|--------|-------|
| `/login` | Public | Email + password → JWT cookie (httpOnly, 24h) |
| `/daftar` | Public | Register → status PENDING |
| `/queue` | PENDING users | Holding page until admin approves |
| `/admin` | ADMIN/SUPER_ADMIN | Approve / reject / manage users |
| `/dashboard` | ACTIVE users | Service Catalog |
| `/app/[appId]` | ACTIVE users | App detail |

**Middleware flow:**
1. Skip public paths: `/login`, `/daftar`, `/api/auth/*`, `/_next/*`, `/favicon.ico`.
2. Read `jwt` cookie → `verifyJwt()`.
3. If invalid/missing → redirect `/login`.
4. If `status === "PENDING"` and not on `/queue` → redirect `/queue`.
5. If `status === "ACTIVE"` and on `/queue` → redirect `/`.
6. Inject `x-user-id`, `x-user-role`, `x-user-email` headers for server components.

## 3.4 Portal → iris-core API Client (`iris-core-client.ts`)

Thin typed `fetch` wrapper. Key behaviors:
- Always sends `X-Iris-Admin-Key: <IRIS_ADMIN_KEY>` header.
- Retries once on network error or 5xx.
- Throws `ApiError(status, message)` on non-OK responses — callers check `error.status === 404` for not-found, other statuses surface correctly (no 401→404 masking).
- `cache: 'no-store'` on all requests.

Methods: `listApps()`, `getApp(id)`, `createApp(body)`, `patchApp(id, body)`, `rotateToken(id)`, `getEvents(id, params)`.

## 3.5 Response Types (Portal-side)

```typescript
interface App {
  id: string; name: string; targetUrl: string; isActive: boolean;
  createdAt: string; updatedAt: string;
  _count?: { routes: number; outboxItems: number };
}

interface AppDetail extends Omit<App, '_count'> {
  routes: Route[];
  routeSyncs: RouteSyncLog[];
  _count: { outboxItems: number; routes: number };
}

interface Route {
  id: string; applicationId: string; path: string; method: string;
  description?: string; schema?: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}

interface OutboxEvent {
  id: string; event: string; routingKey: string; status: string;
  attempts: number; lastError?: string;
  createdAt: string; publishedAt?: string; idempotencyKey?: string;
}
```

## 3.6 npm Scripts

```bash
npm run dev      # next dev → http://localhost:3000
npm run build    # next build
npm run start    # next start
```

## 3.7 Definition of Done — Part 3

- [x] Portal never connects to MySQL directly — all data via `iris-core-client.ts`.
- [x] All portal routes use `appId` (cuid), never the raw token.
- [x] `ApiError` carries HTTP status — no 401/500 masked as 404.
- [x] Custom JWT auth with role-based routing (`PENDING → /queue`, `ADMIN → /admin`).
- [x] `X-Iris-Admin-Key` sent on every admin API call.
- [ ] Real-time event stream (SSE from iris-core outbox) — not yet implemented.
- [ ] Token reveal dialog in portal UI — not yet implemented.

---

# PART 4 — ECOSYSTEM DEFINITION OF DONE

- [x] All routes use `appId` in URLs; raw token only in `Authorization` headers.
- [x] `RouteSchema` and `PublishPayload` match between iris-core zod schemas and iris-node types.
- [x] SDK `init()` calls `/ingress/whoami`; `/healthz`/`/readyz` remain unauthenticated.
- [x] Outbox: `202 Accepted` even when RabbitMQ is down; events drain on reconnect.
- [x] Token rotation invalidates in-process cache immediately.
- [x] MySQL schema includes `User` model for portal auth.
- [ ] Real-time SSE event stream in portal.
- [ ] `@iris/db` shared package (portal currently reads via API, not direct DB).
- [ ] Zero-config auto-registration handshake (currently requires manual token creation via `/admin/applications`).

---

# KNOWN DIVERGENCES FROM ORIGINAL SPEC

| Spec Said | Reality |
|-----------|---------|
| PostgreSQL | **MySQL** (XAMPP) — `schema.prisma` uses `provider = "mysql"` |
| SSO/OIDC auth for portal | **Custom JWT** — `jose` HS256, 24h, backed by `User` table in iris-core DB |
| `@iris/db` shared package | **Not implemented** — portal reads via iris-core HTTP API (`/admin/*`) |
| Portal writes via iris-core API | **Correct** — implemented as specified |
| Real-time SSE event stream | **Not yet implemented** |
| Token reveal dialog | **Not yet implemented** |
| Zero-config auto-registration | **Not implemented** — token created manually via `POST /admin/applications` |
| `@tanstack/react-table` etc. | Portal uses simpler Tailwind 4 components — no heavy table/virtual libs yet |