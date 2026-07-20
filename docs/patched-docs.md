# IRIS Ecosystem — AI Agent Installation Guide

> **Audience:** AI coding agents installing, running, or debugging the IRIS ecosystem.
> Read this top-to-bottom before touching any file.

---

## 0. What Is IRIS?

Three repos, three folders, one ecosystem:

| Folder | Package | Role | Port |
|--------|---------|------|------|
| `STEP1/` | `iris-core` | Gateway (Fastify + MySQL + RabbitMQ) | `3001` |
| `STEP2/` | `@sugity/iris-node` | Node/JS SDK (zero-dep, dual CJS/ESM) | n/a |
| `STEP2/php/` | `Iris.php` | PHP/Laravel SDK (single file) | n/a |
| `STEP3/iris-portal/` | `iris-portal` | Dashboard (Next.js 16 + Tailwind 4) | `3000` |

**Build order must be:** STEP1 → STEP2 → STEP3. STEP3 calls STEP1's admin API. STEP2 calls STEP1's ingress API.

---

## 1. Prerequisites

- **Node.js 20 LTS** (STEP1, STEP2, STEP3)
- **XAMPP MySQL** running on port 3306 (STEP1 uses MySQL — schema.prisma `provider = "mysql"`)
- **RabbitMQ** on `amqp://guest:guest@localhost:5672/` (STEP1 outbox worker)
- **PHP 8.x + Laravel** (only if integrating STEP2/php)

---

## 2. STEP1 — `iris-core` (Gateway)

### 2.1 Install

```bash
cd STEP1
npm install
```

### 2.2 Configure `.env`

Copy `.env.example` → `.env` and fill in:

```env
PORT=3001
DATABASE_URL="mysql://root:@localhost:3306/iris"
RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
LOG_LEVEL=info
TOKEN_CACHE_TTL_MS=15000
ALLOWED_TARGET_CIDRS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8"

# Required — guards all /admin/* and /security/* routes
IRIS_ADMIN_KEY=<random-64-chars>

# Optional — if set, /metrics requires Authorization: Bearer <value>
METRICS_KEY=<random-32-chars>

# Purge published events older than N days (0 = disable)
EVENT_RETENTION_DAYS=90

NODE_ENV=development
```

> **⚠️ DATABASE_URL must be MySQL**, not PostgreSQL. The `.env.example` shows a Neon/Postgres URL as a template but the actual `schema.prisma` provider is `"mysql"`. Use XAMPP.
> Start XAMPP and create an empty `iris` database before migrating.

### 2.3 Migrate & Generate Prisma Client

```bash
npm run db:migrate    # = prisma migrate deploy
npm run db:generate   # = prisma generate
```

### 2.4 Create First Application (get a token)

After the gateway is running, create an app via the admin API to get an `IRIS_PROJECT_TOKEN`:

```bash
curl -X POST http://localhost:3001/admin/applications \
  -H "Content-Type: application/json" \
  -H "X-Iris-Admin-Key: <your-IRIS_ADMIN_KEY>" \
  -d '{"name": "my-app", "targetUrl": "http://localhost:8000"}'
```

Response includes `token` — **save it now, shown only once**.

### 2.5 Run (Dev)

```bash
npm run dev
# = kill-port 3001 && tsx watch --env-file=.env src/app.ts
```

### 2.6 Verify

```bash
curl http://localhost:3001/healthz       # → {"status":"ok"}
curl http://localhost:3001/readyz        # → {"status":"ok","db":"ok","broker":"ok"}
```

---

## 3. STEP2 — `@sugity/iris-node` (Node SDK)

### 3.1 Install & Build

```bash
cd STEP2
npm install
npm run build    # tsup → dist/
```

### 3.2 Use in a Node App

```typescript
import { Iris } from '@sugity/iris-node';
import { registerExpressApp } from '@sugity/iris-node/express';
import express from 'express';

const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN });
const app = express();

app.get('/api/users', (req, res) => res.send([]));

app.listen(3000, async () => {
  await iris.init();                      // verifies token via GET /ingress/whoami
  await registerExpressApp(iris, app);    // pushes routes to /ingress/register
});

// Publish an event anywhere in your app
await iris.publish({ event: 'user_created', data: { id: 123 } });
```

**.env in the client app:**
```env
IRIS_PROJECT_TOKEN=<token-from-step-2.4>
IRIS_GATEWAY_URL=http://localhost:3001
```

### 3.3 PHP/Laravel SDK (STEP2/php/Iris.php)

Single file — no Composer package needed.

1. Copy `STEP2/php/Iris.php` → `app/Services/Iris.php` in your Laravel project.
2. Register via a Service Provider.
3. Add to `.env`:
   ```env
   IRIS_PROJECT_TOKEN=<token>
   IRIS_GATEWAY_URL=http://localhost:3001
   ```
4. Sync routes manually (routes load after boot in Laravel 11):
   ```bash
   php artisan iris:sync
   ```
5. Publish events:
   ```php
   $iris->publish('order_completed', ['order_id' => 123]);
   ```

> **Never put `$iris->syncRoutes()` in a Service Provider `boot()` method** — Laravel 11 routes aren't loaded yet at that point.

---

## 4. STEP3 — `iris-portal` (Dashboard)

### 4.1 Install

```bash
cd STEP3/iris-portal
npm install
```

### 4.2 Configure `.env.local`

Copy `.env.local.example` → `.env.local`:

```env
IRIS_CORE_URL=http://localhost:3001
IRIS_GATEWAY_URL=http://localhost:3001/
IRIS_ADMIN_KEY=<same-value-as-STEP1-IRIS_ADMIN_KEY>
JWT_SECRET=<random-secret-for-portal-sessions>
```

> **`IRIS_ADMIN_KEY` must match STEP1's value exactly.** Portal calls `/admin/*` with `X-Iris-Admin-Key` header.
> `JWT_SECRET` is for the portal's own JWT-based auth system (custom login/register, not SSO/OIDC).

### 4.3 Run

```bash
npm run dev    # next dev → http://localhost:3000
```

### 4.4 Portal Auth Flow

The portal has its own user system (JWT in httpOnly cookie, 24h expiry):

| Route | Purpose |
|-------|---------|
| `/login` | Email + password login |
| `/daftar` | Register (new users start as `PENDING`) |
| `/queue` | Holding page for `PENDING` users |
| `/admin` | Approve / reject pending user accounts |
| `/` | Service catalog (list of apps) |
| `/app/[appId]` | App detail page |

Middleware injects `x-user-id`, `x-user-role`, `x-user-email` headers for server components on every authenticated request.

---

## 5. Troubleshooting

**`X-Iris-Admin-Key` 401 from portal**
- `IRIS_ADMIN_KEY` missing or wrong in `STEP3/iris-portal/.env.local`. Must match `STEP1/.env` exactly.

**Gateway shows 502 `iris-core unreachable`**
- STEP1 not running → `cd STEP1 && npm run dev`.
- Zombie process on port 3001 → `npx kill-port 3001`.

**`GET /app/xxx 404` in Next.js but app exists**
- Real cause: API returned 401 (bad admin key) mishandled as 404. Fix `IRIS_ADMIN_KEY` in portal env, restart.

**Route count = 0 in portal (Laravel)**
- Did not run `php artisan iris:sync`. Run it after adding routes.

**`Unauthorized: invalid token` during `iris:sync` or `iris.init()`**
- `IRIS_PROJECT_TOKEN` doesn't match any app in the DB.
- Check `DATABASE_URL` in STEP1, or create a new app (§2.4) and update the token.

**Prisma `Can't reach database server`**
- XAMPP MySQL not running. Open XAMPP Control Panel → Start MySQL.

**`P2002` unique constraint on `idempotencyKey`**
- Safe — outbox deduplicates retried publishes by design. No action needed.

**RabbitMQ events stuck as `pending`**
- RabbitMQ not running. Start it; outbox worker drains automatically on reconnect.
