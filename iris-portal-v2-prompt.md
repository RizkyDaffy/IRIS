# SYSTEM INSTRUCTION: IRIS PORTAL V2 UPGRADE (CAVEMAN / PONYTAIL MODE)

Listen up. You are going to upgrade the `iris-portal` (located in `STEP3/iris-portal`), integrating modern enterprise features. You are going to do this without turning the existing working gateway codebase into an over-engineered dumpster fire. 

**STRICT DIRECTIVES — DO NOT IGNORE THESE OR I WILL REJECT THE PR:**
1. **NO REWRITES:** The current routing and IRIS logics work. Leave them alone. You are an integration surgeon, not a bulldozer. Adjust the new features to wrap around the existing data contracts.
2. **DON'T REINVENT THE WHEEL (UI):** We already have a UI kit in `STEP3 (UI)/horizon-ui`. Use it. If you build a custom button or a custom chart wrapper when Horizon already has one, you fail. Import their components, wire the data, and move on.
3. **NO DUMB ERRORS:** 
   - Never expose plaintext tokens in URLs or UIs after creation.
   - We already fixed the `ERR_SSL_WRONG_VERSION_NUMBER` (targetUrl HTTPS vs HTTP mismatch) and the `401 Unauthorized` (Argon2 hash mismatch). Do NOT touch the `iris-core` proxy logic or the DB schema that handles these, unless explicitly adding RBAC tables. 
   - Keep the core proxy fast and dumb.

---

## ARCHITECTURE & FEATURES TO IMPLEMENT

We are building an API Management Portal that doesn't suck. Think Anthropic's clean minimalism combined with Mixpanel/Datadog's data density.

### 1. IDENTITY & RBAC (Super Admin, Admin, Developer)
- **Signup Flow (`/daftar`):** 
  - Standard form: First Name, Middle Name, Email, Password, Captcha, ToS checkbox.
  - **The Purgatory (`/queue`):** Any new signup goes to `status: PENDING`. If they try to hit `/login`, `/dashboard`, or anything else, redirect them to `/queue`. Do not build a complicated bypass. A simple middleware check is enough.
  - Super Admin must click "Approve" in the dashboard.
- **Login Flow (`/login`):** Email + Password (with toggle visibility) + Captcha. Standard JWT/Session based auth. If `PENDING`, redirect to `/queue`. If `ACTIVE`, let them in.
- *Caveman note:* Super Admin is auto-seeded in the DB on first boot. 

### 2. ANALYTICS & TELEMETRY (The "Mixpanel" UI)
Developers need to know why their API is failing before they complain to us.
- **`/dashboard`:** High-level overview. Active apps, total requests (24h), error rates. 
- **`/dataflow` & `/requestflow`:** A visual topology or time-series chart of traffic hitting their `targetUrl`. Use the charts from `horizon-ui`. Show RED metrics (Rate, Errors, Duration).
- **`/security`:** Token usage anomalies. Show a chart of 401s and rate-limit triggers. 
- *Caveman note:* You don't need a massive time-series database yet. Query the existing `RouteSyncLog` and `EventOutbox` or simple request logs stored by `iris-core` (or mock the aggregation if the DB doesn't have timeseries tables yet, but keep the UI real).

### 3. THE "POWER BI" DATA GRID
- **Customizable Data Views:** Developers want to see their outbox events and webhooks in a dense, Excel-like table. 
- **Requirements:** Use a heavy-duty data table (like `@tanstack/react-table` which we already use) with bulk actions, sorting, filtering, and export to CSV/Excel. 
- Do not build a canvas from scratch. Use the existing table components from the UI kit and give it a dense, enterprise look.

---
## HOW TO EXECUTE
1. Read the `horizon-ui` source to understand its component API.
2. Setup the Next.js `middleware.ts` for the RBAC and `/queue` routing. Keep it under 50 lines. No crazy abstractions.
3. Build the pages using the existing `@iris/db` Prisma client (from `STEP1`).
4. Just make it work, make it fast, and make it look premium. 

Go.
