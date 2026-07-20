# IRIS — "HTTP 401 / Connection Error" Runbook

When the portal shows **"Failed to connect to iris-core"** or **"iris-core error [401]"**, follow this checklist top-to-bottom. First match = your fix.

---

## Quick Diagnosis (30 seconds)

Open two browser tabs:
1. `http://localhost:3001/healthz` — should return `{"ok":true}`
2. `http://localhost:3001/readyz` — should return `{"db":"ok","broker":"ok"}`

| healthz result | readyz result | Your problem |
|---|---|---|
| ❌ Cannot connect | — | STEP1 is not running → see §1 |
| ✅ ok | `db: "error"` | Database unreachable → see §2 |
| ✅ ok | `broker: "error"` | RabbitMQ down (non-fatal for portal reads) |
| ✅ ok | ✅ ok | Admin key mismatch → see §3 |

---

## §1 — STEP1 is not running

```
Failed to connect to iris-core: iris-core unreachable at http://localhost:3001 — ECONNREFUSED
```

**Fix:** Start STEP1.
```bash
cd IRIS/STEP1
npm run dev
```

Check it says: `{"msg":"Gateway listening on port 3001"}`.

Then restart STEP3 if you started it before STEP1:
```bash
# In STEP3/iris-portal terminal — Ctrl+C then:
npm run dev
```

---

## §2 — Database unreachable (Prisma connection pool)

Symptoms: STEP1 is running, portal returns `HTTP 500`, STEP1 logs show P2024 or P2001.

**Fix A — Neon database went idle (most common):**

Neon free tier suspends after 5 minutes of inactivity. Just make any request and it will wake:
```bash
curl http://localhost:3001/readyz
```
Wait 5 seconds, try the portal again.

**Fix B — Wrong DATABASE_URL parameters:**

Your `STEP1/.env` DATABASE_URL must include these parameters for Neon's PgBouncer:
```
DATABASE_URL="...?sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=30"
```

If any of these are missing, add them and restart STEP1.

**Fix C — P2024 connection pool timeout:**

This means too many concurrent DB operations. The outbox worker poll rate may be too aggressive.
Check `STEP1/src/workers/outboxWorker.ts` — `POLL_INTERVAL_MS` should be `10_000` (10 seconds), not `2_000`.

---

## §3 — Admin key mismatch (HTTP 401)

Symptoms: STEP1 is running, healthz OK, but portal shows `iris-core error [401]`.

**Cause:** `IRIS_ADMIN_KEY` in STEP1 and STEP3 don't match, or one side is missing it.

**Fix:** Check both files have the same value:

```bash
# In STEP1/.env:
IRIS_ADMIN_KEY="iris-admin-dev-key"

# In STEP3/iris-portal/.env.local:
IRIS_ADMIN_KEY=iris-admin-dev-key
```

They must be byte-for-byte identical (no quotes mismatch, no trailing space). After fixing, restart both services.

**If IRIS_ADMIN_KEY is intentionally not set:** The admin routes are open (dev mode). The portal will still send no key and it will work. If you're getting 401 with no key set on STEP1, something else is wrong — go to §4.

---

## §4 — Trailing slash in IRIS_CORE_URL (double-slash URLs)

Symptoms: Random 404s or 401s, hard to reproduce.

**Fix:** Check `STEP3/iris-portal/.env.local` — the URL must NOT have a trailing slash:
```bash
# Correct:
IRIS_CORE_URL=http://localhost:3001

# Wrong — causes //admin/applications paths:
IRIS_CORE_URL=http://localhost:3001/
```

After fixing `.env.local`, hard-restart STEP3 (`Ctrl+C` then `npm run dev`).

---

## §5 — Next.js cached a bad response

Symptoms: Portal showed an error once, now shows it every time even after fixing STEP1.

Next.js dev mode can cache Server Component responses. Force a fresh fetch:
1. Stop STEP3 (`Ctrl+C`)
2. Delete `.next/` cache: `Remove-Item -Recurse -Force STEP3\iris-portal\.next`
3. Restart: `npm run dev`

---

## §6 — Port conflict (both STEP1 and STEP3 on port 3000)

Symptoms: Portal loads but shows `{"message":"Route GET:/admin not found","statusCode":404}` at `localhost:3000`.

This means STEP1 grabbed port 3000 before Next.js did.

**Fix:** Check `STEP1/.env` has `PORT=3001`. If it says `PORT=3000`, change it and restart STEP1.

Expected ports:
- **STEP1 (iris-core):** `:3001`
- **STEP3 (iris-portal):** `:3000`

---

## Environment Variable Reference

| Variable | File | Correct value (dev) |
|---|---|---|
| `PORT` | `STEP1/.env` | `3001` |
| `DATABASE_URL` | `STEP1/.env` | Neon pooler URL with `pgbouncer=true&connection_limit=5&pool_timeout=30` |
| `IRIS_ADMIN_KEY` | `STEP1/.env` | Any string — must match portal |
| `IRIS_CORE_URL` | `STEP3/.env.local` | `http://localhost:3001` (no trailing slash) |
| `IRIS_ADMIN_KEY` | `STEP3/.env.local` | Must match STEP1's value exactly |
