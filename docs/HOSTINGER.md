# Deploying Pak Tenders on Hostinger

This guide deploys the monorepo to Hostinger's managed **Node.js Web Apps** (hPanel). It is a two-application deployment: the Next.js website and the NestJS API run as separate Web Apps and share one external PostgreSQL database.

Hostinger reference: <https://docs.hostinger.com/node.js/overview>

---

## 0. Why the domain shows "Coming soon"

If `https://<your-domain>` returns Hostinger's PHP "Coming soon" page, the Node app is not attached to that domain. hPanel's **Git** feature (Advanced → Git) only copies files into `public_html`; it does **not** install dependencies or keep a Node process running. A Next.js app deployed that way cannot work.

Hostinger's own instructions: *"If the domain you're deploying under is already added to your hosting plan, remove that website first — the Node.js deploy flow expects to create a fresh slot for the domain."*

Checklist:

1. Confirm the plan is **Business Web Hosting** or **Cloud Startup / Professional / Enterprise / Enterprise Plus**. Node.js Web Apps are not available on Premium or on a Website Builder plan.
2. Delete the placeholder website that owns the domain (hPanel → Websites → the site → Delete). Back up anything you need first.
3. Create the apps with **Websites → Add Website → Node.js web app** (not Advanced → Git).

---

## 1. Architecture on Hostinger

```
Browser
  |
  v
Web App A  (Next.js, this repo, root /)
  |  SSR fetch + x-internal-key
  v
Web App B  (NestJS, this repo, root /)  --->  External PostgreSQL (Supabase/Neon)
  |
  +--> optional Redis (Upstash) for scheduled collection
```

Hostinger does not provide PostgreSQL or Redis. Use a managed PostgreSQL instance (Supabase, Neon, Railway, RDS). Redis is optional: without it the collection queue is disabled and **Run now** executes synchronously.

Hostinger stops Node processes after a period without traffic. The next request starts them again (a cold start of roughly 1–3 seconds). This is why the long-running BullMQ worker is disabled in this guide.

---

## 2. Build settings

Both apps use the **same repository and branch**, root directory `/`, and application type **Other**. Using `Other` keeps the pnpm workspace intact and avoids Next.js's standalone preset, whose server is emitted at `.next/standalone/apps/web/server.js` in a monorepo.

### Web App A — website

| hPanel field | Value |
| --- | --- |
| Application type | `Other` |
| Root directory | `/` |
| Branch | `main` |
| Node.js version | `22` (LTS) or `24` |
| Package manager | `pnpm` (auto-detected from `pnpm-lock.yaml`) |
| Build script | `build:hostinger:web` |
| Output directory | *(leave empty — ignored when an entry file is set)* |
| Entry file | `hostinger/web-server.cjs` |

`hostinger/web-server.cjs` starts Next.js with `next({ dev: false })`, binds `0.0.0.0` and uses the `PORT` Hostinger assigns. Do not replace it with `next start` unless the host supports a custom start command.

### Web App B — API

| hPanel field | Value |
| --- | --- |
| Application type | `Other` |
| Root directory | `/` |
| Branch | `main` |
| Node.js version | `22` (LTS) or `24` |
| Package manager | `pnpm` |
| Build script | `build:hostinger:api` |
| Output directory | *(leave empty)* |
| Entry file | `hostinger/api-server.cjs` |

Both build scripts are Turborepo filters that also build the shared `packages/*` and `database` workspaces in dependency order:

```bash
pnpm build:hostinger:web   # turbo run build --filter=@paktenders/web...
pnpm build:hostinger:api   # turbo run build --filter=@paktenders/api...
```

Build limits: 15 minutes for install and 15 minutes for the build script. If the Next.js build is killed for memory, move to a Cloud plan.

### Why the website builds with Webpack, not Turbopack

Hostinger runs CloudLinux 8 (glibc 2.28). Next.js 16's native SWC/Turbopack binary
(`@next/swc-linux-x64-gnu`) is linked against glibc 2.29, so the loader falls back to
the WebAssembly package and Turbopack aborts with:

```
Error: Turbopack is not supported on this platform (linux/x64) because native
bindings are not available.
```

`apps/web` therefore builds with `next build --webpack`. Webpack uses the WASM SWC
bindings that do load on this host, and the resulting `.next` output is served by
`hostinger/web-server.cjs` exactly like a Turbopack build. `next dev` still uses
Turbopack locally. Do not "simplify" the build script back to plain `next build`
without re-testing on the host.


### Domains

Give the API its own hostname, for example `api.paktenders.pk` or a second Hostinger subdomain. Never point the website and the API at the same hostname: both need port 443 and Hostinger serves one Web App per domain.

---

## 3. Environment variables

Hostinger injects variables into **both build and runtime**. `NEXT_PUBLIC_*` values are baked into the website build, so changing them triggers a redeploy.

Generate secrets locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Web App A (website)

```dotenv
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://gleeful-honeydew-albatross-05.hostingersite.com
NEXT_PUBLIC_API_URL=https://api.your-domain.example
API_INTERNAL_URL=https://api.your-domain.example
SITE_URL=https://gleeful-honeydew-albatross-05.hostingersite.com
INTERNAL_API_KEY=<same 48-byte value as the API>
```

Optional: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GTM_ID`, `GOOGLE_SITE_VERIFICATION`.

The website does **not** need `DATABASE_URL`, JWT secrets, Redis or S3.

### Web App B (API)

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/paktenders?schema=public&sslmode=require
API_PUBLIC_URL=https://api.your-domain.example
CORS_ORIGINS=https://gleeful-honeydew-albatross-05.hostingersite.com
SITE_URL=https://gleeful-honeydew-albatross-05.hostingersite.com
JWT_ACCESS_SECRET=<48-byte random>
JWT_REFRESH_SECRET=<different 48-byte random>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
INTERNAL_API_KEY=<same value as the website>
TRUST_PROXY_HOPS=2
API_PORT=4000

# Hostinger runs one process per Web App and sleeps it when idle.
COLLECTION_ENABLED=false
COLLECTION_WORKER_ENABLED=false
REDIS_URL=
OCR_ENABLED=false
AI_COLLECTION_ENABLED=false
CHATBOT_ENABLED=false
```

Notes:

- `CORS_ORIGINS` is a comma-separated list of exact origins, with no trailing slash.
- `TRUST_PROXY_HOPS=2` matches Hostinger's CDN + LiteSpeed chain. If every visitor appears to share one rate-limit bucket (site-wide 429s), raise it to `3`; if clients can spoof `X-Forwarded-For`, lower it.
- `PORT` is set by Hostinger. The API prefers it over `API_PORT`.
- Leave `REDIS_URL` empty. With no Redis the scheduler and worker stay off, and **Admin → Collection → Run now** processes synchronously.
- Keep `OCR_ENABLED=false` on shared plans: Tesseract downloads language data and is memory-hungry.
- `AI_*`, `EMAIL_*`, `S3_*`, and payment variables may be omitted; those integrations stay in their disabled state.

---

## 4. Database

Hostinger's database tooling is MySQL-only. Use external PostgreSQL.

1. Create a project and database (Supabase, Neon, Railway, RDS, …).
2. Copy the connection string. For Supabase's transaction pooler use:

   ```dotenv
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true&connection_limit=1"
   ```

   For Neon use the pooled host and `?sslmode=require`.
3. Apply migrations and seed **once** from your machine (Hostinger has no terminal for Web Apps):

   ```powershell
   $env:DATABASE_URL="postgresql://...production..."
   $env:SEED_ADMIN_EMAIL="admin@your-domain.example"
   $env:SEED_ADMIN_PASSWORD="<strong password>"
   $env:SEED_DEMO_DATA="false"
   pnpm db:deploy
   pnpm db:seed
   ```

   `dotenv` does not override variables that already exist in the shell, so the production values win over your local `.env`.

4. Confirm the seed used no demo rows:

   ```sql
   select count(*) from tenders where "isDemo" = true;  -- must be 0
   ```

5. If your database requires an IP allowlist, allow Hostinger's outbound IPs or `0.0.0.0/0` (Neon and Supabase allow all by default).

Migrations are **not** run during the Hostinger build. Run `pnpm db:deploy` before deploying code that needs a new migration.

---

## 5. First deployment checklist

- [ ] Plan supports Node.js Web Apps
- [ ] Placeholder website removed from the domain
- [ ] External PostgreSQL created; `pnpm db:deploy` and `pnpm db:seed` succeeded
- [ ] API Web App built and **Running**
- [ ] `https://<api-domain>/v1/health` returns `{"status":"ok","database":"connected"}`
- [ ] Website Web App built and **Running**
- [ ] `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` set **before** the website build
- [ ] `CORS_ORIGINS` contains the website origin
- [ ] `INTERNAL_API_KEY` is identical on both apps
- [ ] Home page shows live data, not empty states
- [ ] Register, login, logout, and `/dashboard` work
- [ ] `/admin` login works; `/admin/health` shows the database connected
- [ ] Seeded admin password changed
- [ ] SSL active and HTTPS enforced (secure auth cookies require HTTPS)
- [ ] Demo tenders removed

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Domain shows "Coming soon" (PHP) | Domain is still attached to a placeholder website, or the repo was deployed with Advanced → Git | Delete the placeholder site, then create a **Node.js web app** |
| Build fails: "No package.json found" | Root directory set to a folder without `package.json` | Set root directory to `/` |
| Build fails: `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` / `workspace:*` | Root directory set to `apps/web` or `apps/api`, so the workspace root is missing | Use root directory `/` and the `build:hostinger:*` scripts |
| Build fails: `next.config.ts` / TypeScript errors | Node 18 selected | Use Node 22 or 24 |
| Build fails: "Next.js build produced no standalone server" | The Next.js preset was used on this monorepo | Use application type **Other** with `hostinger/web-server.cjs` |
| Build fails: heap out of memory | Plan memory limit | Move to a Cloud plan, or build locally and deploy an archive |
| Build fails: `Turbopack is not supported on this platform` | Hostinger glibc 2.28, Turbopack needs 2.29 | Keep `next build --webpack` in `apps/web/package.json` |
| `/dashboard` or `/admin` returns `200` with an empty body | LiteSpeed + CDN drops a bodiless redirect whose `Location` is a relative path | `src/proxy.ts` builds an absolute login URL with a tiny HTML body — keep it that way |
| App not responding after a green build | Wrong port or entry file | Entry must be `hostinger/web-server.cjs` (web) / `hostinger/api-server.cjs` (API); both honour `PORT` |
| `502` / blank page | API crashed on boot | Open **Runtime Logs**; the usual cause is a missing `DATABASE_URL` or JWT secret |
| Home page renders but all lists are empty | Website cannot reach the API | Set `NEXT_PUBLIC_API_URL` **and** `API_INTERNAL_URL` to the public API URL, then redeploy the website |
| Login succeeds then immediately signs out | Secure cookie over HTTP, or wrong site URL | Enable SSL, set `NEXT_PUBLIC_SITE_URL` to the `https://` origin, redeploy |
| Browser console CORS errors | Origin missing from `CORS_ORIGINS` | Add the exact `https://` website origin to the API and restart |
| Site-wide `429 Too Many Requests` | Trusted proxy hops wrong, so all traffic shares one IP bucket | Set `TRUST_PROXY_HOPS=2` (or `3`), restart the API |
| `P1001: Can't reach database server` | Database asleep, wrong host/port, or IP not allowed | Wake the DB, verify the pooled connection string and allowlist |
| `Prisma Client could not locate the Query Engine` | Build and runtime platforms differ | Redeploy so `prisma generate` runs on Hostinger's Linux builder |
| Uploads disappear after a redeploy | Local document storage is inside the build directory | Configure S3, or accept that Hostinger uploads are temporary |
| Collection never runs on schedule | No Redis and the worker is disabled | Expected on Hostinger; use **Run now** or move the worker to a VPS |

Build logs and runtime logs are under the Web App's **Deployments** and **Runtime Logs** pages in hPanel. If a deploy fails, the first error line in the build log is usually the real cause; the AI summary can be misleading.

---

## 7. What is intentionally limited on Hostinger

- **No background collection.** Hostinger sleeps idle processes, so BullMQ cannot stay connected. Scheduled collection, retries, dead-letter retries and overlap locks require a long-running host (VPS/container) with Redis.
- **No OCR.** Tesseract language data and page rasterisation exceed shared-plan memory. Text PDFs still parse; scanned PDFs are stored with an empty extraction and flagged for review.
- **Local document storage is ephemeral.** Files written under the build directory are replaced on redeploy. Configure S3 for durable originals.
- **Cold starts.** The first request after idle waits for Next.js/Nest to boot.
- **One process per app.** Horizontal scaling and worker separation need a VPS or container platform.
- **No shell.** Migrations, seeds and maintenance scripts run from your machine against the production `DATABASE_URL`.

The rest of the platform — public catalogue, search, tender detail pages, accounts, dashboards, admin review, manual imports and the API — runs normally.
