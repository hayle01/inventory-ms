# Deployment Plan — Free-Tier Production

How to get this system live using free-tier services, without weakening any of the security rules in `CLAUDE.md`. Written as a reference to follow alongside the live walkthrough; each step says what to do and why.

## Why not "just Vercel"

Vercel hosts static sites and short-lived serverless functions. This system needs three things Vercel doesn't provide:

1. **A persistent worker process** (`apps/worker`) that stays running to drain the email queue — serverless functions can't do this.
2. **A persistent API process** with a pooled MongoDB connection and Redis-backed sessions — technically possible as Vercel functions, but cold starts and per-invocation connection churn make it a poor fit for a session-based app.
3. **MongoDB with a replica set** — required for the multi-document transactions this system depends on everywhere stock moves (`CLAUDE.md`: "do not rely on standalone MongoDB," even in production). Vercel doesn't host databases.

## Topology

| Piece | Service | Plan |
|---|---|---|
| Frontend (`apps/web`) | **Vercel** | Free |
| API (`apps/api`) | **Render** — Web Service | Free |
| Worker (`apps/worker`) | **Render** — Background Worker | Free |
| MongoDB | **MongoDB Atlas** | Free M0 (real 3-node replica set) |
| Redis | **Upstash** | Free |
| Outbound email | Existing Gmail SMTP, or **Resend** free tier | Free |

**Known free-tier tradeoff:** Render's free web services and workers spin down after ~15 minutes idle and cold-start (30–50s) on the next request. Fine for a demo/pilot; if that's not acceptable later, Render's paid tier ($7/mo) removes it — nothing else in this plan needs to change.

## The cross-origin cookie problem, and how this plan avoids it

The frontend and API will live on different domains (`*.vercel.app` and `*.onrender.com`). Session cookies here are deliberately `HttpOnly`, `Secure`, `SameSite=Lax` per `CLAUDE.md` — and a `Lax` cookie is **not sent by the browser on cross-site `fetch()` calls**, only on top-level navigations. Naively pointing the SPA at the Render API URL directly would mean login appears to work (the cookie gets set) but every subsequent API call silently goes out with no cookie attached, and the user gets logged out immediately.

**The fix is not to loosen the cookie policy.** Instead, this plan makes the two origins *look* the same to the browser: Vercel's `rewrites` config proxies every `/api/*` request from the frontend's own domain straight through to the Render API. The browser only ever talks to one origin, `SameSite=Lax` works exactly as designed, and no security code changes at all.

## Step-by-step

### 1. MongoDB Atlas (do this first — everything else needs the connection string)

1. Create a free account at Atlas, create a free **M0** cluster (any nearby region).
2. Database Access → add a database user (username/password, "Read and write to any database").
3. Network Access → add `0.0.0.0/0` for now (Render's IPs aren't static on the free tier) — this is standard practice for a free-tier managed database secured by username/password + TLS, not a real exposure.
4. Get the connection string from **Connect → Drivers**. It looks like:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ims?retryWrites=true&w=majority`
   M0 clusters are always a replica set, so transactions work out of the box — no extra setup needed.

### 2. Upstash Redis

1. Create a free account, create a Redis database (any nearby region).
2. Copy the connection string in `redis://` or `rediss://` (TLS) form from the dashboard.

### 3. Render — API

1. New → Web Service → connect the `hayle01/inventory-ms` GitHub repo.
2. Root directory: repo root (it's a pnpm workspace monorepo, build from the top).
3. Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @inventory-ms/config run build && pnpm --filter @inventory-ms/contracts run build && pnpm --filter @inventory-ms/api run build`
4. Start command: `node apps/api/dist/server.js`
5. Environment variables — set every value from `.env.example`, with these production-specific ones:
   - `NODE_ENV=production`
   - `MONGODB_URI` — the Atlas connection string from step 1
   - `REDIS_URL` — the Upstash connection string from step 2
   - `TRUST_PROXY=1` (Render sits behind a proxy)
   - `APP_BASE_URL` — the Vercel frontend URL, once you have it (step 5)
   - `CORS_ALLOWED_ORIGINS` — the Vercel frontend URL (same value)
   - `SESSION_SECRET`, `CSRF_SECRET`, `PASSWORD_PEPPER`, `MFA_ENCRYPTION_KEY` — generate fresh random 64-char values for production, never reuse the local dev ones
   - `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE`/`MAIL_USER`/`MAIL_PASSWORD`/`MAIL_FROM` — your SMTP credentials
6. Deploy. Once live, note the Render URL (`https://<name>.onrender.com`).

### 4. Render — Worker

1. New → Background Worker → same GitHub repo.
2. Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @inventory-ms/config run build && pnpm --filter @inventory-ms/contracts run build && pnpm --filter @inventory-ms/worker run build`
3. Start command: `node apps/worker/dist/index.js`
4. Same environment variables as the API service (it needs `MONGODB_URI`, `REDIS_URL`, and the `MAIL_*` vars at minimum — copy the whole set for simplicity).

### 5. Vercel — Frontend

1. New Project → import the same GitHub repo.
2. Root directory: `apps/web`.
3. Framework preset: Vite. Build command: `pnpm build` (or leave default, Vercel auto-detects). Output directory: `dist`.
4. Add a `vercel.json` in `apps/web` with a rewrite so `/api/*` proxies to the Render API — **this is the piece that solves the cross-origin cookie problem** (see below).
5. Deploy. Note the Vercel URL, then go back and set `APP_BASE_URL`/`CORS_ALLOWED_ORIGINS` on Render to that exact URL, and redeploy the API.

`apps/web/vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://<your-render-api>.onrender.com/api/$1" }
  ]
}
```

### 6. Run migrations and seed the production database

From your local machine, pointed at the Atlas connection string (one-time, not something Render needs to do automatically):

```bash
MONGODB_URI="<atlas-connection-string>" pnpm --filter @inventory-ms/api run db:migrate
MONGODB_URI="<atlas-connection-string>" pnpm --filter @inventory-ms/api run db:verify-indexes
MONGODB_URI="<atlas-connection-string>" SEED_ORG_NAME="<your org>" pnpm --filter @inventory-ms/api run seed
```

The seed script prints the admin password once if `SEED_ADMIN_PASSWORD` isn't set — save it, it's not recoverable afterward except via the forgot-password flow.

### 7. Smoke test

- Visit the Vercel URL, log in as the seeded admin.
- Confirm `/api/v1/...` calls succeed (check the Network tab — they should hit your own domain, not `onrender.com`, proving the rewrite is working).
- Create a user, confirm the invite email arrives (check the worker's Render logs if not).
- Post a full receive-to-issue cycle to confirm MongoDB transactions are actually committing on Atlas.
- Log out, confirm session cookie is cleared and protected routes redirect to `/login`.

## What to never do here

- Never set `SameSite=None` or drop `Secure`/`HttpOnly` to work around the cross-origin issue — use the Vercel rewrite instead.
- Never reuse local dev secrets (`SESSION_SECRET`, `CSRF_SECRET`, etc.) in production.
- Never point `MONGODB_URI` at a standalone Mongo instance — Atlas free tier is already a replica set, so there's no reason to.
- Never commit real production secrets into `.env.example` or any tracked file — they only ever live in Render's/Vercel's environment variable settings.
