# IRIS — Next-Level Analysis
> Written from perspective of: senior CySec engineer, SRE, and legacy systems maintainer.
> Mode: caveman + ponytail. No padding. Facts only.

---

## 1. SECURITY SYSTEM — What Senior CySec Says

### What's Done Right

- **Argon2id token hashing.** Correct algorithm. Hash stored, plaintext gone. tokenPrefix narrows DB lookup without exposing hash. Timing-safe verify via argon2 lib.
- **Token never in URL.** `/app/:appId/api/*` uses appId (public) + Authorization header (secret). Correct. Resolved the #1 footgun from early drafts.
- **SHA-256(token) as cache key.** Cache never holds raw token. In-memory only, bounded TTL. Correct.
- **Pino redacts `req.headers.authorization`.** Logs clean by design.
- **Body size limit.** 10MB. Blocks naive payload floods.
- **Helmet.** Basic HTTP header hardening. Present.
- **Rate limit.** Global 100/min. Per-app on ingress. Present.
- **SSRF defense via ALLOWED_TARGET_CIDRS.** `isAllowedTarget()` called on write AND on proxy execution. Belt + suspenders.
- **Single schema owner (`@iris/db`).** Prevents token-hashing logic from diverging in two codebases.
- **Portal writes through `iris-core-client.ts`** — no direct DB writes from the portal.
- **SSO/OIDC gate on portal.** RBAC: Viewer vs Owner/Admin. Audit log on sensitive actions.

### What CySec Would Flag

#### CRITICAL: Admin Routes — Zero Auth
```typescript
// admin.ts line 20 — actual comment in codebase:
// ponytail: no auth on admin routes — internal network only
```
`/admin/applications` POST creates apps, returns plaintext tokens. No auth enforced. Trusts network perimeter entirely.

**Risk:** Any process on the same machine or container network can create apps, rotate tokens, read all targetUrls, and deactivate anything. Container escape → full IRIS compromise in one HTTP call.
**Fix:** Require `IRIS_ADMIN_KEY` header (shared secret, already documented in `.env` reference and troubleshoot guide — just not enforced in code). OR mTLS between portal and core. Pick one. Ship it.

#### HIGH: In-Process Token Cache — No Invalidation on Rotation
Token rotation writes new `tokenHash` to DB. But old token SHA-256 key stays live in cache until TTL expires (10–30s window). During that window, rotated token still authenticates.

**Risk:** Token leaked → rotate immediately → attacker still has 30s window. In high-frequency environments (automated attacks), 30s is plenty.
**Fix:** On rotation, explicitly `cache.delete(cacheKey(old_token))`. Requires knowing old token — or flush all entries for `appId` on rotation. Map indexed by appId as secondary key would solve this.

#### HIGH: `IRIS_ADMIN_KEY` Optional = Unauthenticated by Default
`iris-troubleshoot.md §3` says: "If IRIS_ADMIN_KEY is intentionally not set: The admin routes are open (dev mode)."
This is fine for dev. Not fine when someone deploys to a VPS, skips the env var, and doesn't notice.
**Fix:** On boot, if `NODE_ENV=production` and `IRIS_ADMIN_KEY` is unset, crash with explicit error. Fail-fast. Never silently open admin in prod.

#### MEDIUM: `/metrics` Endpoint — No Auth
Prometheus `/metrics` endpoint is unauthenticated. In prod, this leaks: request counts per appId, error rates, outbox failure patterns, AMQP reconnect frequency.

**Risk:** Operational intelligence leak. Attacker learns which apps are active, their traffic patterns, when the system degrades.
**Fix:** Auth guard or IP allowlist on `/metrics`. Prometheus scrapers support bearer token auth.

#### MEDIUM: React `Option B` — Token in Frontend
`iris.md` explicitly documents:
```typescript
// Option B (internal tools only — token visible in browser):
Authorization: `Bearer ${import.meta.env.VITE_IRIS_TOKEN}`
```
Even with the warning, this ships as documented pattern. Developers copy the closest example.
**Risk:** Token extracted from browser devtools, bundle, or network tab. Trivial.
**Fix:** Remove Option B from docs. Period. If needed internally, proxy it server-side always.

#### MEDIUM: `EventOutbox.payload` — Unbounded JSON, PII in Plaintext
Events like `user_created { id, email }` land in `EventOutbox.payload` as JSON, stored in Postgres indefinitely. No TTL, no purge policy, no encryption at rest noted.
**Risk:** DB dump = full event history, including PII. GDPR/PDPA exposure. Also: outbox table grows unbounded → query degradation.
**Fix:** Define retention policy. Purge published events after N days. Encrypt sensitive fields at app layer before `publish()`. Document this clearly.

#### LOW: `tokenPrefix` — First 8 Chars of Hex Token
Prefix leaks partial token information. Low risk since 8 chars of a 64-char hex token is negligible entropy reduction. But: if token generation ever switches to a structured format (e.g., `iris_prod_...`), prefix leaks environment.
**Fix:** Use a separate random prefix — 4 random bytes stored separately, not token substring. Future-proof.

#### LOW: Cache Prune on Every Write
`pruneExpired()` runs on every successful token verification. O(n) scan of the cache Map on hot path.
**Risk:** Not exploitable, but degrades under load. 10,000 active apps × high traffic = constant full-cache scan.
**Fix:** LRU-Map or timed cleanup interval. Not urgent now, flag for Phase 2.

---

## 2. HOW SERVERS WILL PERFORM — SRE Perspective

### Current Architecture

```
Client → iris-core (Fastify, Node 20, single process)
               ↓
         PostgreSQL (Neon/PgBouncer)
               ↓
         RabbitMQ (amqplib)
               ↓
         Target apps (undici proxy)
```

### Load Characteristics

**Bottleneck 1 — Argon2id on cold cache hit.** Argon2id is deliberately slow (~50–500ms depending on params). Every cold token verification blocks the event loop. Node.js event loop = single thread. Spike of 100 concurrent cold misses = 5–50 seconds of blocked requests.

**Mitigation in spec:** tokenPrefix narrows DB lookup. Cache reduces Argon2 calls. But cache is per-instance — horizontal scaling means N replicas × cold cache after deploy.
**Fix Phase 2:** Redis shared cache. Or JWT tokens (stateless verify, sub-millisecond) for proxy path only, keeping Argon2 for ingress mutations.

**Bottleneck 2 — Outbox worker polling Postgres.** 10s poll interval on `EventOutbox WHERE status='pending'`. Under high publish volume, pending rows accumulate. Postgres index on `(status, createdAt)` helps but polling is inefficient.
**Fix:** LISTEN/NOTIFY pattern — Postgres triggers notify on insert → worker wakes immediately. Drops latency, kills polling overhead.

**Bottleneck 3 — PgBouncer connection limit.** `connection_limit=5` in Neon dev config. 5 concurrent DB queries. Fine for dev. In prod, under heavy proxy load, queries queue behind pool. Timeout = `P2024`.
**Fix:** Proper Postgres instance with `connection_limit=20–50`. Or Prisma Data Proxy with serverless scaling.

**Bottleneck 4 — Undici proxy, streaming.** Good choice. `undici.request()` streams body — no full buffering. Handles large responses. 10s timeout is correct.
**Risk:** Very long SSE or WebSocket connections through proxy will hold a connection open indefinitely. `undici` doesn't support WebSocket upgrade.
**Fix:** Document that WebSocket/SSE from target apps is not supported through the proxy path. Or add explicit upgrade detection + 501 response.

**Scaling verdict:**
| Load | Status |
|---|---|
| < 50 RPS | Fine as-is |
| 50–500 RPS | Needs Redis cache, bigger Postgres pool |
| 500–5000 RPS | Needs horizontal scaling + Redis + LISTEN/NOTIFY |
| > 5000 RPS | Needs architectural rethink (separate proxy vs. event plane) |

---

## 3. WHAT COULD HAPPEN FROM THIS IDEAS — Impact Analysis

### Positive Outcomes (When It Works)

1. **Microservice visibility problem solved.** Every service auto-registers its routes. Portal shows the full API surface. Zero manual docs. This is actually valuable — large teams lose track of what endpoints exist. IRIS makes the entire network observable in one place.

2. **Event durability without Kafka.** Outbox pattern + RabbitMQ is a solid, battle-tested approach. Small teams get durable event delivery without running Kafka. Real value.

3. **Zero-dependency SDK.** Native `fetch`, no runtime deps. This ages well. Libraries rot; stdlib doesn't.

4. **Single token model is simple.** Developers understand "one secret, one service." Beats OAuth client_credentials flow for internal use.

5. **Legacy service integration.** Any service that can do HTTP can integrate. PHP, shell scripts, cURL. The three-call contract is language-agnostic. Good.

### Negative Outcomes (When It Fails)

1. **Single point of failure.** iris-core goes down → all proxied traffic dies. Every integrated service loses API routing. This is the cost of centralizing auth+proxy.

2. **Gateway becomes a target.** All tokens flow through one service. Compromise iris-core = access to all target services. High-value attack surface.

3. **Outbox grows unbounded.** No published event purge = Postgres table bloat over months. Query on `(status, createdAt)` degrades. System slows silently.

4. **Developers bypass IRIS for "simplicity."** If the gateway adds latency, developers route directly. IRIS loses observability. The network becomes dark again.

5. **Portal gives false confidence.** Routes shown in portal are what services *registered* — not necessarily what they actually expose. Stale registrations = misleading docs.

---

## 4. WORST CASE POSSIBLE

**Scenario A: Admin route exploited in production**

1. Developer deploys iris-core to VPS. Skips `IRIS_ADMIN_KEY` (default = off).
2. Attacker discovers `http://your-iris:3001/admin/applications` via port scan or leaked URL.
3. Calls `POST /admin/applications` with `{ name: "attacker-service", targetUrl: "http://attacker.com" }`.
4. Receives plaintext token. Now has full authenticated access to proxy routing.
5. Calls `GET /admin/applications` — sees all registered apps, their targetUrls (internal service addresses), route inventories.
6. Modifies targetUrl of a real app to point to attacker-controlled server — `PATCH /admin/applications/:id`.
7. All traffic to that app now flows through attacker server. Full MITM. No detection unless portal watcher notices.

**Damage:** Token theft, internal service inventory exposure, traffic interception, potential credential harvest from forwarded requests.
**Timeline to exploit:** < 10 minutes with basic HTTP tooling.

**Scenario B: Outbox event data breach**

1. Postgres credentials exposed (leaked `.env`, weak password, Neon API key compromise).
2. Attacker dumps `EventOutbox`. Gets full event history: user emails, order IDs, payment references, whatever services published.
3. No encryption at rest, no retention limit = everything ever published is there.

**Scenario C: Cache timing attack + token rotation race**

1. Attacker captures valid token via other means.
2. Victim rotates token immediately.
3. Attacker uses old token within 30s cache TTL window.
4. Attacker makes changes via proxy + ingress routes.
5. Victim thinks rotation fixed it. It didn't. Attacker still inside.

---

## 5. FUTURE VULNERABILITIES

### Near-term (1–2 years)

**Supply chain attack on `argon2` package.** npm package wrapping C library. If compromised, token hashing silently degrades. No fallback.
**Mitigation:** Pin version. Audit with `npm audit`. Consider `@node-rs/argon2` (Rust NAPI, different attack surface).

**`app._router.stack` Express introspection breakage.** Express v5 changed internal router structure. `registerExpressApp` walks `_router.stack` — undocumented internal. Express upgrade = silent discovery failure, no routes registered, portal shows empty.
**Mitigation:** Express v5 compat layer. Or middleware-based route collection instead of post-hoc stack walking.

**Neon / PgBouncer version drift.** `pgbouncer=true&connection_limit=5` are Neon-specific. Migrating to self-hosted Postgres = connection issues, possible silent failures.
**Mitigation:** Isolate DB adapter config. Document migration path away from Neon.

### Medium-term (2–5 years)

**RabbitMQ deprecation of classic queues.** RabbitMQ 3.13+ pushes quorum queues as default. Classic queues in "deprecated" track. `amqplib` usage may hit compat issues.
**Mitigation:** Migrate to quorum queue setup. Or swap broker for NATS JetStream (simpler, faster, better Node support).

**Prisma breaking changes.** `$transaction` behavior, `findFirst` semantics, generated types have broken between major versions. IRIS uses `$transaction` for atomic route sync.
**Mitigation:** Lock Prisma version. Integration tests cover the transaction. Upgrade deliberately.

**JWT ecosystem pressure.** Bearer token + Argon2 lookup will feel increasingly old-fashioned vs signed JWTs. Pressure to "modernize" may lead to insecure JWT implementation (HS256 with weak secret, etc.).
**Mitigation:** If adopting JWT: RS256 only, JWKS endpoint, short expiry (15min), rotate signing key quarterly.

### Long-term (5+ years)

**Node.js LTS death.** Node 20 EOL 2026-04-30. Long-running systems on unmaintained runtimes accumulate CVEs silently.
**Mitigation:** Containerize. Upgrade Node as part of annual dependency audit. Docker image makes this a one-line change.

**Side-channel attacks on in-memory cache.** Multi-tenant cloud environments, cache key timing (SHA-256 comparison) could theoretically be exploited. Unlikely now; concerning at scale.

**tokenPrefix collision.** Birthday paradox at ~65,000 apps with 8 hex chars prefix space. Not a problem for small deployments. Flag for large-scale use.

---

## 6. LEGACY PRIVATE API — Maintenance & Long-Term Viability

### Why IRIS Is Actually a Good Legacy Candidate

1. **Spec-driven.** `agents.md` is unusually complete. New engineers read it and understand the system without reverse-engineering code.
2. **Three-call contract is stable.** `/ingress/whoami`, `/ingress/register`, `/ingress/publish` — backward-compatible. SDK v1 still works against v3 gateway if these stay stable.
3. **Zero-dep SDK.** Nothing to rot. `fetch` and `crypto` are stable stdlib.
4. **Database-backed state.** Postgres + outbox = durable, queryable, debuggable. Better than Redis-only systems.
5. **Self-hosted.** No SaaS vendor dependency. You own the data, the uptime, the keys.

### What Needs to Change for Legacy Production Use

| Item | Current State | Required |
|---|---|---|
| Admin route auth | Unauthenticated | `IRIS_ADMIN_KEY` required on prod startup |
| Token rotation cache invalidation | TTL-based only | Immediate invalidation on rotate |
| Event purge policy | None | Configurable retention (30/90/365 days) |
| Metrics endpoint auth | Open | IP allowlist or bearer auth |
| Horizontal scaling cache | In-process Map | Redis (Phase 2, spec already noted it) |

### Versioning Strategy for Legacy API

For IRIS to serve as a stable private API gateway long-term, pin the ingress contract:

```
/v1/ingress/whoami
/v1/ingress/register
/v1/ingress/publish
/v1/app/:appId/api/*
```

Version prefix on all routes. `v1` supported forever. `v2` introduces breaking changes. Old SDKs keep working.

**Why this matters:** If token model changes (e.g., JWT), gateway path changes, or required fields added to `RouteSchema` — without versioning, every integrated service breaks simultaneously.

### Operational Playbook

```
Monthly:
  - npm audit on iris-core
  - Review EventOutbox table size (purge published rows older than policy)
  - Check AMQP reconnect counter in /metrics (spike = broker instability)

Quarterly:
  - Rotate all IRIS_PROJECT_TOKENs (iterate /admin/applications, POST rotate-token, update client .env)
  - Review ALLOWED_TARGET_CIDRS against current network topology
  - Node.js LTS check — upgrade if within 6 months of EOL

Yearly:
  - Prisma version review
  - RabbitMQ version review
  - argon2 package audit
  - Review portal SSO/OIDC provider contract
```

### Minimum Viable Legacy API Config

If IRIS used purely as internal private API (no portal, no event bus), strip to essentials:

```
iris-core (minimal):
  - POST /admin/applications         ← create app (admin-only)
  - GET  /ingress/whoami             ← token validation
  - POST /ingress/register           ← route registration
  - GET  /app/:appId/api/*           ← proxy

  Drop: EventOutbox, RabbitMQ, outboxWorker, portal

Result: Stateless-ish API gateway with token auth + routing.
        Single Postgres table (Application + Route).
        10MB Docker image.
        Maintainable by one engineer.
```

This "lite mode" is a legitimate, long-lived internal API gateway. Simple enough to understand completely in one reading. Complex enough to solve the auth + routing problem.

### Multi-Tenant Future Path

If IRIS scales beyond one org:

1. Add `Organization` model above `Application`. One org = one isolated token namespace.
2. Each org gets isolated RabbitMQ vhost.
3. Admin routes scoped per-org via org-level admin key.
4. Portal shows per-org data only.

Additive — doesn't break existing single-org deployments.

---

## Summary Verdict

| Dimension | Score | Notes |
|---|---|---|
| Security Architecture | 7/10 | Solid crypto. Admin route auth hole is the fatal flaw. |
| Scalability | 5/10 | Fine < 500 RPS. Falls apart at scale without Redis + LISTEN/NOTIFY. |
| Code Quality | 8/10 | Clean, spec-driven, well-structured. |
| Legacy Viability | 7/10 | Good bones. Needs versioned API + retention policy + prod config enforcement. |
| Worst Risk | CRITICAL | Unauthenticated admin routes in production deployment. |
| Best Feature | — | Outbox pattern + three-call contract. Actually portable and durable. |

**One fix now:** Add `IRIS_ADMIN_KEY` enforcement in `admin.ts`. Check header. Reject if missing in prod. Everything else is Phase 2.
