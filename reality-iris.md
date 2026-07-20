# IRIS — REALITY CHECK
### Senior Engineer Assessment (Google/Meta/Stripe-level lens)

> Honest. No padding. Code examined directly. Written as if reviewing a PR at a FAANG or infra-focused startup.

---

## VERDICT FIRST

**IRIS is architecturally sound for a v0.5 internal tool.** Core decisions are correct — Argon2id, outbox pattern, token-not-in-URL, Fastify, zod validation, graceful shutdown. Whoever designed this understands real gateway concepts. But it's not production-grade yet. It has a mix of *good fundamentals* and *critical missing infrastructure* that would get it rejected in any serious eng review. Below is the unfiltered breakdown.

---

## 1. THE GAPS — Brutally Honest

### 1.1 CRITICAL (System Will Break Under Real Load or Failure)

**A. Argon2 token verify on every proxy request — O(n×hash) latency bomb**
- Current: every proxy request hits DB + `argon2.verify()` on cache miss. Argon2id by design is slow (that's the point). Under load (100+ rps), cache miss rate will cause latency spikes.
- Cache is in-process `Map`. Single instance = fine. Two instances = split cache = half traffic always misses.
- **Real fix:** Cache on verified `appId`, not just token hash. Bloom filter on tokenPrefix before DB query. Redis-backed shared cache for multi-instance. Or switch to stateless JWT for proxy auth (different tradeoff — token rotation becomes harder).

**B. Outbox worker is polling, not event-driven — 10s delivery latency minimum**
- `setInterval(processBatch, 10_000)` — events are guaranteed stale 0–10 seconds before delivery.
- `take: 50` per batch. High volume = queue growth outpaces processing.
- No backpressure: if RabbitMQ is slow, worker keeps picking rows, overloading channel.
- **Real fix:** After writing outbox row, `NOTIFY` (Postgres) or equivalent. Worker listens, wakes immediately. Keep polling as fallback heartbeat only. Also: batch size should be configurable and dynamic.

**C. In-process token cache broken in multi-replica deployment**
- `invalidateApp(appId)` only evicts local Map. In K8s with 3 replicas: rotate token → replica 1 cache cleared, replicas 2+3 still serve old token for up to `TOKEN_CACHE_TTL_MS` (15s default).
- **Real fix:** Redis pub/sub invalidation. Or reduce TTL to 0 and accept the Argon2 cost. Or use token versioning in DB.

**D. Single outbox worker process — no concurrency, no distribution**
- One `setInterval` loop, `running` flag prevents overlap. Fine for one instance.
- Multi-instance: every replica runs its own outbox worker. All pick the same `pending` rows. Events published N times to RabbitMQ — no deduplication at broker layer.
- **Real fix:** Optimistic locking or `SELECT ... SKIP LOCKED` (Postgres feature, not in MySQL 5.x). Or: only one designated worker instance (sidecars, external job). MySQL 8+ has `SKIP LOCKED` — confirm MySQL version.

**E. No request-level timeout from client to gateway**
- `bodyTimeout: 10_000, headersTimeout: 10_000` on undici request to upstream. Good.
- But no client-facing timeout — client can hold connection open to gateway indefinitely while gateway waits for upstream. Under upstream slowness, gateway threads pile up.
- **Real fix:** `Fastify` `connectionTimeout` + overall request deadline, not just per-upstream-call.

**F. `isAllowedTarget` trusts all hostnames unconditionally**
- From `env.ts`: if hostname is not an IP regex match, it returns `true` — all hostnames allowed.
- Attacker registers app with `targetUrl: "http://evil.internal/steal"` — passes CIDR check because hostname, not IP. Internal service DNS resolves. Gateway proxies attacker traffic to internal network.
- **Real fix:** Allowlist hostnames too, or resolve hostname to IP at registration time and validate CIDR then. Or block all hostnames except `localhost`.

**G. `RouteSchema[]` replace is full-delete + full-insert — no diff**
- `deleteMany + createMany` every sync. 1000-route app syncs on every deploy = 1000 deletes + 1000 inserts, lock contention on `Route` table during sync.
- Portal shows "0 routes" during the window between delete and insert commit.
- **Real fix:** Upsert with diff. Hash the incoming route set, compare to stored hash, skip transaction if no change. Or: use `INSERT ... ON DUPLICATE KEY UPDATE`.

---

### 1.2 IMPORTANT (Won't Crash But Will Burn You)

**H. MySQL chosen for production workload of an API gateway**
- MySQL is fine. But IRIS proxy handles potentially high-frequency reads (token verification per proxy request). MySQL's locking model under mixed read/write is less optimal than PostgreSQL for this pattern.
- XAMPP in dev = MySQL 8 or 5.7 depending on version. `SKIP LOCKED` requires MySQL 8.0.1+. Migrations may behave differently across versions.
- **Impact:** Not urgent, but creates future ceiling. Note it.

**I. `X-Iris-Admin-Key` is a static shared secret — no rotation mechanism**
- Rotating it requires redeploying both STEP1 and STEP3 simultaneously with the new value. Brief window of mismatch = portal broken.
- No audit log of who called admin endpoints — only the admin key, not the user behind it.
- **Real fix:** Admin key rotation runbook. Or move to short-lived tokens for admin access (IRIS itself could sign them).

**J. Portal auth JWT secret `JWT_SECRET` is manually set — no rotation**
- 24h expiry is fine. But if `JWT_SECRET` rotates, all active sessions immediately invalidate — users logged out with no warning.
- No refresh token, no session revocation list.
- **Real fix:** Document rotation procedure. Implement refresh tokens or accept the forced-logout behavior as policy.

**K. `EventOutbox` `status` field is `String`, not enum at DB level**
- `status: String @default("pending")` — any typo (`"pendnig"`) passes Prisma, reaches DB, breaks worker query silently.
- **Real fix:** MySQL ENUM or Prisma `@@check` constraint. 3-line change.

**L. No versioning on RouteSchema or PublishPayload contracts**
- If IRIS adds a required field to `RouteSchema`, all registered clients break silently — their SDK sends old shape, gateway validates with new zod schema, 400 errors start appearing.
- No API version header (`X-Iris-Version`), no version negotiation.
- **Real fix:** Semver the contract. Add `X-Iris-SDK-Version` header. Gateway logs mismatched versions as warnings. Breaking changes require major version bump.

**M. Rate limit is global 100/min — not per-application**
- One spammy app can starve all others. Current rate limit is on IP, not on `applicationId`.
- **Real fix:** Rate limit on resolved `applicationId` post-auth. Fastify rate-limit supports custom keys.

**N. Outbox `purgeStaleEvents` runs every poll cycle (every 10s)**
- Every 10 seconds: `DELETE ... WHERE status='published' AND publishedAt < cutoff`. On large tables this is a full index scan + delete. MySQL doesn't have partial index DELETE optimization.
- **Real fix:** Run purge less frequently (cron-style, e.g., once per hour). Or soft-delete with a separate archival job.

**O. No circuit breaker on proxy upstream**
- If upstream service is down, every proxy request attempts connection, waits 10s, returns 502. Under traffic: 100 rps × 10s = 1000 concurrent connections queued against dead upstream, gateway OOM risk.
- **Real fix:** Circuit breaker (opossum or similar). After N failures in window, open circuit, return 503 immediately, retry probe.

---

### 1.3 HYGIENE (Code Quality, Maintainability)

**P. Zero test coverage exists**
- `vitest` installed. No test files found in directory tree. `npm run test` = passes vacuously.
- Auth logic, outbox retry math, token cache invalidation — none tested.
- **Real fix:** Minimum: unit test `resolveAndVerify` (valid token, invalid token, expired cache, rotated token), outbox backoff math, CIDR validation edge cases.

**Q. `check_routes.ts`, `fix_app.js`, `test-hash.js` loose in STEP1 root**
- Debug scripts committed to root. Fine for dev. Not fine for "stable for decades."
- **Real fix:** Move to `scripts/` folder or gitignore. Document their purpose.

**R. Port default in `env.ts` is 3000, not 3001**
- `PORT: z.coerce.number().default(3000)` — but all docs say port 3001. If `PORT` not set in `.env`, gateway starts on 3000, portal calls 3001, connection refused.
- **Real fix:** Change default to `3001`, or assert PORT is always explicitly set.

**S. `create_henkaten.ts` hardcoded app bootstrapping script in STEP1**
- Fine for internal use. Not fine if IRIS becomes a standard other teams use — they inherit Henkaten-specific bootstrap scripts.
- **Real fix:** Move to `examples/` or separate seeding folder.

**T. Admin routes return `tokenHash` and `tokenPrefix` in some DB queries**
- `admin.ts` `getApp()` uses `include: { routes, routeSyncs }` — does not explicitly exclude `tokenHash`/`tokenPrefix`. If Prisma includes those by default on the related `Application` object, they leak to portal response.
- **Real fix:** Always use `select` with explicit field list, never `include` alone on sensitive models.

---

## 2. CAN IRIS BE A REGULATION / STANDARD?

### Yes — but only within one organization's scope. Not across org boundaries.

**What "regulation" means here:** Future projects in the same org/team MUST register with IRIS, push routes via SDK, publish events through IRIS outbox. IRIS becomes the mandatory API integration layer.

**Why this CAN work internally:**
- Single-organization with authority to enforce tooling standards ✓
- IRIS already owns the contract: token + route schema + event shape ✓
- Portal provides discoverability — one place to see all registered services ✓
- SDK abstraction: new apps only need 3 lines of code to integrate ✓
- This is exactly what internal platforms teams at Stripe, Shopify, Grab do ✓

**Why this CANNOT work as external/cross-org standard — 4 hard blockers:**

1. **No versioned public API contract.** External teams need stability guarantees. IRIS has no semver on its gateway API, no deprecation policy, no changelog enforced by CI. Breaking change = breaking every registered app with no warning.

2. **No multi-tenant isolation.** All apps share the same MySQL database, the same RabbitMQ instance, the same `iris.events` exchange. App A's bad behavior (event storm, route sync spam) affects App B directly. Real platform requires tenant isolation at the storage layer.

3. **No SLA / uptime commitment.** If IRIS gateway goes down, ALL registered apps lose proxy + event delivery. No fallback. No documented RTO/RPO. You can't mandate that 50 apps depend on you if you can't promise 99.9% uptime with an on-call rotation.

4. **Authentication model is organization-specific.** `X-Iris-Admin-Key` as a shared secret, manual token provisioning via `curl`, PENDING user approval queue — these are internal-ops patterns. External adopters need OAuth2/OIDC integration, self-service token management, and API key scopes.

**Conclusion:** IRIS can be an **internal org standard**. It cannot be an **industry standard or cross-org regulation** without major architectural investment (multi-tenancy, versioned API, SLA, external IdP).

---

## 3. HOW TO MAKE IRIS SENIOR-ENGINEER APPROVED

> Rule: Do NOT change the existing gateway flows (A/B/C/D). These are the OG contracts. Layer on top, backward-compatible only.

### Tier 1 — Non-Negotiable for Any Production System

| # | What | Why | Effort |
|---|------|-----|--------|
| 1 | Fix `isAllowedTarget` hostname bypass | Active SSRF vulnerability | 1 day |
| 2 | Fix multi-replica outbox double-publish | Data integrity | 2 days |
| 3 | Per-app rate limiting (post-auth, on `applicationId`) | Fairness | 4 hours |
| 4 | `EventOutbox.status` DB-level enum constraint | Silent data corruption | 1 hour |
| 5 | Write integration tests for auth + outbox | Confidence for changes | 3 days |
| 6 | Fix PORT default (3000 → 3001) | Config correctness | 5 min |
| 7 | Explicit `select` on admin queries (no tokenHash leak) | Security | 2 hours |

### Tier 2 — Required for Multi-Instance / Scale

| # | What | Why | Effort |
|---|------|-----|--------|
| 8 | Redis-backed token cache with pub/sub invalidation | Multi-replica correctness | 2 days |
| 9 | MySQL 8+ `SKIP LOCKED` on outbox worker | Prevent multi-instance double-publish | 1 day |
| 10 | Circuit breaker on proxy upstream | Prevent gateway OOM under upstream failure | 1 day |
| 11 | Route sync diff/upsert instead of delete+insert | Zero portal downtime during sync | 1 day |
| 12 | Configurable + less-frequent outbox purge | DB performance | 4 hours |

### Tier 3 — Required to Enforce as Internal Standard

| # | What | Why | Effort |
|---|------|-----|--------|
| 13 | `X-Iris-SDK-Version` header + gateway version logging | Contract versioning | 1 day |
| 14 | SDK version enforcement: warn on old, reject on ancient | Prevent drift | 2 days |
| 15 | Per-app event quotas (max events/day, max routes) | Prevent abuse from any one service | 2 days |
| 16 | Admin audit log (who called `/admin/*`, when, what) | Compliance, incident response | 1 day |
| 17 | Admin key rotation runbook + zero-downtime procedure | Ops safety | 4 hours |
| 18 | `CHANGELOG.md` on gateway API, enforced in PR reviews | Stability contract | Process, not code |

### Tier 4 — Long-Term (Decades-Stable)

| # | What | Why | Effort |
|---|------|-----|--------|
| 19 | Migrate to PostgreSQL | Better tooling, `SKIP LOCKED`, LISTEN/NOTIFY, partial indexes | 1 week |
| 20 | Move outbox to event-driven (LISTEN/NOTIFY or debezium CDC) | True near-realtime delivery | 2 weeks |
| 21 | SDK major version (v2) with deprecated v1 shim | Allow breaking changes without breaking old apps | 2 weeks |
| 22 | Multi-tenant event exchange isolation (per-org exchange) | Prevent cross-tenant event visibility | 1 week |
| 23 | OpenTelemetry traces on every proxy request | Distributed tracing across IRIS + upstream | 1 week |

---

## 4. WHAT IRIS MUST HAVE TO MEET API GATEWAY STANDARD

Industry standard API gateways (Kong, AWS API GW, Envoy, Traefik) all share these properties. IRIS has some. The gaps are marked.

| Property | IRIS Has It? | Notes |
|----------|-------------|-------|
| Request routing | ✅ | `/app/:appId/api/*` proxy |
| Auth at gateway layer | ✅ | Argon2id token verification |
| Rate limiting | ⚠️ Partial | Global only, not per-app |
| Request/response logging | ✅ | pino, requestId |
| Health/readiness endpoints | ✅ | `/healthz`, `/readyz` |
| Metrics endpoint | ✅ | `/metrics` prom-client |
| Circuit breaker | ❌ Missing | Critical for stability |
| Retry policies | ❌ Missing | Gateway-level, not just SDK |
| Request timeout control | ⚠️ Partial | Upstream timeout yes, client timeout no |
| TLS termination | ❌ Missing | Rely on reverse proxy (nginx/caddy) in front |
| API versioning | ❌ Missing | No version negotiation |
| Quota management | ❌ Missing | No per-app limits on volume |
| Distributed tracing | ❌ Missing | `X-Request-Id` only, no trace propagation |
| Plugin/middleware extensibility | ❌ Missing | Route-level hooks exist (Fastify), but no plugin API |
| Service discovery | ⚠️ Manual | Manual `targetUrl` registration, no DNS/Consul discovery |
| Canary / traffic splitting | ❌ Missing | Single `targetUrl` per app, no weights |
| Event streaming | ⚠️ Partial | Outbox → RabbitMQ, no SSE/webhook delivery to consumers |
| Admin API (CRUD) | ✅ | Full CRUD on applications |
| Audit logging | ❌ Missing | No record of who did what via admin API |
| Token rotation | ✅ | Implemented, cache invalidated immediately |
| Idempotent event publish | ✅ | `idempotencyKey` + P2002 dedup |
| Durable event delivery | ✅ | Outbox pattern, survives broker outage |
| Multi-tenancy | ❌ Missing | Shared DB/broker, no isolation between apps |

**Score: 9/22 full, 5/22 partial, 8/22 missing.**

For an internal V1 tool: respectable. For a regulated internal standard that 20+ apps depend on: needs Tier 1+2 fixes minimum before mandate.

---

## 5. THE ONE-PARAGRAPH REALISTIC ROADMAP

Fix Tier 1 (SSRF bypass, tokenHash leak, per-app rate limit, EventOutbox enum, tests) — 2 weeks, one engineer. Then fix Tier 2 (Redis cache, `SKIP LOCKED`, circuit breaker) — 2 more weeks. At that point, IRIS is stable enough to be declared an internal standard for the organization. Mandate adoption via a formal ADR (Architecture Decision Record) that all new projects must reference. SDK versioning (`X-Iris-SDK-Version`) and admin audit log (Tier 3) come in parallel with first mandated adopter. PostgreSQL migration (Tier 4) is optional unless load demands it — MySQL 8 with `SKIP LOCKED` is sufficient for dozens of services. Do not do Tier 4 preemptively. Do not add canary routing, plugin API, or multi-tenancy until there is actual demand. Premature generalization is the reason most internal platforms die — they become too complex to maintain and teams route around them.

---

*Assessment date: 2026-07-20. Based on direct code inspection of STEP1, STEP2, STEP3 source.*
