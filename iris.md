# IRIS — Integration Guide for AI Agents & Developers

> **For AI agents:** Read this file top-to-bottom once before writing any integration code.
> All you need is in here. Do not guess — the contracts are exact.

---

## What is IRIS?

IRIS is a self-hosted API gateway + event bus. Your app registers with the gateway once, then:

1. All your API traffic is proxied through the gateway (auth, rate-limit, observability for free).
2. Events you publish are durably queued and fanned out via RabbitMQ.
3. The IRIS Portal shows all registered apps, their routes, and their events in real-time.

**You do not run any IRIS infrastructure yourself.** IRIS is already running at:

- **Gateway:** `http://localhost:3001/` (or `http://localhost:3001` in local dev)
- **Portal:** `http://localhost:3000` (local dev only)

---

## Step 0 — Get a Token (One-Time Setup)

1. Open the IRIS Portal → click **+ New Application**.
2. Enter a name (e.g. `my-billing-service`) and your app's local URL (e.g. `http://localhost:4000`).
3. **Copy the secret token shown on screen. It is shown exactly once.**
4. Store it in your project's environment as `IRIS_PROJECT_TOKEN`.

That's all the human interaction needed. The rest is code.

---

## The Three HTTP Calls (What the SDK Does)

Every integration — regardless of language — reduces to three HTTP calls.
The SDK just wraps these for you. If there's no SDK for your language, call these directly.

### 1. Handshake — Confirm token is valid
```
GET  http://localhost:3001//ingress/whoami
Authorization: Bearer <IRIS_PROJECT_TOKEN>

200 -> { "id": "...", "name": "my-app", "isActive": true }
401 -> invalid token
```

### 2. Route Registration — Tell IRIS what endpoints your app has
```
POST http://localhost:3001//ingress/register
Authorization: Bearer <IRIS_PROJECT_TOKEN>
Content-Type: application/json

[
  { "path": "/api/users", "method": "GET", "description": "List users" },
  { "path": "/api/users/:id", "method": "DELETE", "description": "Remove user" }
]

200 -> { "synced": 2 }
```
Call this once at app startup. Safe to re-call — it replaces the full route set (idempotent).

### 3. Event Publishing — Emit a durable event
```
POST http://localhost:3001//ingress/publish
Authorization: Bearer <IRIS_PROJECT_TOKEN>
Content-Type: application/json

{ "event": "user_created", "data": { "id": 42, "email": "a@b.com" } }

202 -> { "id": "...", "status": "pending" }
```
Returns immediately. Delivery to RabbitMQ is async + durable (survives gateway restarts).

---

## Integration by Stack

---

### Node.js / Bun (TypeScript)

```bash
npm install @sugity/iris-node
# or: bun add @sugity/iris-node
```

```typescript
import { Iris } from '@sugity/iris-node';

const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN! });

// On startup:
await iris.init();
await iris.syncRoutes([
  { path: '/api/orders', method: 'GET', description: 'List orders' },
  { path: '/api/orders', method: 'POST', description: 'Create order' },
]);

// Anywhere:
iris.publish({ event: 'order_placed', data: { orderId: 123 } });

// Graceful shutdown:
process.on('SIGTERM', async () => { await iris.flush(); process.exit(0); });
```

---

### Express.js

```typescript
import express from 'express';
import { Iris } from '@sugity/iris-node';
import { registerExpressApp } from '@sugity/iris-node/express';

const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN! });
const app = express();

app.get('/api/users', (req, res) => res.json([{ id: 1 }]));
app.post('/api/orders', (req, res) => {
  iris.publish({ event: 'order_placed', data: req.body });
  res.json({ ok: true });
});

app.listen(4000, async () => {
  await iris.init();
  await registerExpressApp(iris, app); // auto-discovers all routes
});
```

`registerExpressApp` walks `app._router.stack`, normalises paths, dedupes, and calls `/ingress/register`.
No manual route list needed.

---

### Fastify

```typescript
import Fastify from 'fastify';
import { Iris } from '@sugity/iris-node';
import { registerFastifyApp } from '@sugity/iris-node/fastify';

const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN! });
const app = Fastify();

app.get('/api/health', async () => ({ ok: true }));
app.post('/api/orders', async (req) => {
  iris.publish({ event: 'order_placed', data: req.body });
  return { ok: true };
});

await app.ready();
await iris.init();
await registerFastifyApp(iris, app); // uses Fastify onRoute hook — stable public API
await app.listen({ port: 4000 });
```

---

### Next.js (App Router)

```bash
npm install @sugity/iris-node
```

**`lib/iris.ts`** (server-only singleton):
```typescript
import { Iris } from '@sugity/iris-node';

// Module-level singleton — Next.js reuses across requests in the same process.
const iris = new Iris({ projectToken: process.env.IRIS_PROJECT_TOKEN! });
export default iris;
```

**`instrumentation.ts`** (Next.js 14.1+ — runs once on server boot):
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: iris } = await import('./lib/iris');
    await iris.init();
    // App Router has no runtime route introspection — list manually:
    await iris.syncRoutes([
      { path: '/api/orders', method: 'POST', description: 'Create order' },
      { path: '/api/users', method: 'GET', description: 'List users' },
    ]);
  }
}
```

**Route Handler:**
```typescript
// app/api/orders/route.ts
import iris from '@/lib/iris';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  iris.publish({ event: 'order_placed', data: body });
  return NextResponse.json({ ok: true });
}
```

> Do NOT import `iris` in files with `'use client'`. Server-only module.

---

### React / Vite (SPA Frontend)

Frontends cannot hold a secret token safely. Two options:

**Option A (recommended):** Your backend uses the SDK, the frontend calls your backend normally.

**Option B (internal tools only — token visible in browser):**
```typescript
async function publishEvent(event: string, data: unknown) {
  await fetch('http://localhost:3001//ingress/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_IRIS_TOKEN}`,
    },
    body: JSON.stringify({ event, data }),
  });
}
```

---

### Laravel / PHP

No Composer package. Copy the single-file client:

```bash
cp /path/to/IRIS/STEP2/php/Iris.php app/Services/Iris.php
```

**`.env`:**
```env
IRIS_PROJECT_TOKEN=your-token-here
IRIS_GATEWAY_URL=http://localhost:3001/
```

**`AppServiceProvider.php`:**
```php
use App\Services\Iris;

public function register(): void
{
    $this->app->singleton(Iris::class, fn() => new Iris(
        token: env('IRIS_PROJECT_TOKEN'),
        gatewayUrl: env('IRIS_GATEWAY_URL', 'http://localhost:3001/'),
    ));
}
```

**Middleware (init once per process):**
```php
use App\Services\Iris;
use Illuminate\Support\Facades\Cache;

public function handle($request, Closure $next)
{
    Cache::rememberForever('iris_init', function () {
        $iris = app(Iris::class);
        $iris->init();
        $iris->syncRoutes(\Route::getRoutes());
    });
    return $next($request);
}
```

**Controller:**
```php
use App\Services\Iris;

class OrderController extends Controller
{
    public function store(Request $request, Iris $iris): JsonResponse
    {
        $order = Order::create($request->validated());
        $iris->publish('order_placed', ['order_id' => $order->id]);
        return response()->json($order, 201);
    }
}
```

---

### Plain PHP (no framework)

```php
<?php
require_once __DIR__ . '/Iris.php';

$iris = new Iris(token: $_ENV['IRIS_PROJECT_TOKEN']);
$iris->init();

$iris->publish('page_viewed', ['url' => $_SERVER['REQUEST_URI']]);

$iris->syncRoutes([
    ['path' => '/checkout', 'method' => 'POST', 'description' => 'Process checkout'],
]);
```

---

### Shell / cURL (CI, scripts, any language)

```bash
#!/bin/bash
IRIS_URL="http://localhost:3001/"

# Verify token
curl -s "${IRIS_URL}/ingress/whoami" \
  -H "Authorization: Bearer ${IRIS_PROJECT_TOKEN}"

# Publish event
curl -s -X POST "${IRIS_URL}/ingress/publish" \
  -H "Authorization: Bearer ${IRIS_PROJECT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"event":"deploy_completed","data":{"sha":"abc123","env":"production"}}'

# Sync routes
curl -s -X POST "${IRIS_URL}/ingress/register" \
  -H "Authorization: Bearer ${IRIS_PROJECT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[{"path":"/api/health","method":"GET"}]'
```

---

## How Proxying Works

Once registered, the gateway routes external traffic to your app:

```
Client:  GET http://localhost:3001//app/<appId>/api/users
         Authorization: Bearer <token>

Gateway:
  1. Extracts appId from path (appId is public, not secret — see §0.1)
  2. Verifies the Bearer token (Argon2 hash lookup, short-TTL in-process cache)
  3. Strips hop-by-hop headers, injects X-Request-Id + X-Forwarded-For
  4. Streams to your app:  GET http://your-app:4000/api/users
  5. Streams response back to client

Your app: sees a normal HTTP request. No code changes needed.
```

---

## For AI Agents — Implementation Checklist

When a user says "add IRIS to this project", do this in order:

- [ ] **Detect stack** — check `package.json`, `composer.json`, `go.mod`, `Pipfile`, etc.
- [ ] **Find token** — look for `IRIS_PROJECT_TOKEN` in `.env`. If missing, tell the user to get one from the portal and stop.
- [ ] **Install client:**
  - Node/Bun: `npm install @sugity/iris-node`
  - PHP/Laravel: copy `IRIS/STEP2/php/Iris.php` into the project
  - Other: raw HTTP per the three-calls contract above
- [ ] **Initialize on startup** — `init()` once. Never per-request.
- [ ] **Sync routes** — `syncRoutes()` / `registerExpressApp()` / `registerFastifyApp()` once after init.
- [ ] **Add `publish()` calls** — at key business events (order placed, user signup, etc.).
- [ ] **Verify** — run the app, open the portal at `http://localhost:3000`. App + routes appear within seconds.

Done. The user can go get coffee.

---

## Error Reference

All errors use this envelope:
```json
{ "error": { "code": "UPSTREAM_TIMEOUT", "message": "...", "requestId": "b3f1..." } }
```

| Code | Meaning | Fix |
|---|---|---|
| `INVALID_TOKEN` | Bearer token wrong or expired | Rotate token in portal |
| `APPLICATION_NOT_FOUND` | appId in URL doesn't exist | Check portal for correct appId |
| `APPLICATION_INACTIVE` | App was deactivated | Re-activate in portal |
| `UPSTREAM_TIMEOUT` | Your app took >10s | Optimise the endpoint |
| `UPSTREAM_UNREACHABLE` | Gateway can't connect to targetUrl | Check app is running, targetUrl is correct |

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `IRIS_PROJECT_TOKEN` | Your app | Secret token. **Never commit to git.** |
| `IRIS_GATEWAY_URL` | Your app (optional) | Default: `http://localhost:3001/` |
| `DATABASE_URL` | STEP1 | Postgres connection string |
| `RABBITMQ_URL` | STEP1 | RabbitMQ connection string |
| `PORT` | STEP1 | Gateway port (default: 3001) |
| `IRIS_CORE_URL` | STEP3 | URL of STEP1 gateway, used by the portal |
