# Deployment guide

This guide describes a straightforward production deployment: PostgreSQL, one or more Node processes for the API, one or more Node processes for the website, and a reverse proxy for TLS.

> Managed shared hosting (Hostinger Web Apps) has different constraints: no PostgreSQL, no Redis and no long-running worker. Use [HOSTINGER.md](HOSTINGER.md) for that target.

Phase 1 does not include Dockerfiles, Kubernetes manifests or a CI pipeline. The commands below are the supported baseline; containerisation can be layered on without changing the application.

---

## 1. Topology

```
Internet
   |
   v
Nginx / load balancer (TLS)
   |                         |
   | paktenders.pk           | api.paktenders.pk
   v                         v
Next.js :3000            NestJS :4000
   |                         |
   +-----------+-------------+
               |
               +--> Redis :6379 (optional; collection queues and locks)
               |
               v
        PostgreSQL :5432
        (private network, TLS)
```

- The website and API are stateless. Sessions live in PostgreSQL, so multiple instances can share the database.
- PostgreSQL must not be exposed to the public internet.
- `API_INTERNAL_URL` should point at the API over the private network or loopback.
- Redis is optional. When it is present, one API process runs the collection worker and scheduled sources are collected. When it is absent, collection runs only when an administrator triggers a source manually.

---

## 2. Server prerequisites

| Requirement | Notes |
| --- | --- |
| Linux server | 2 vCPU / 2 GB RAM is a reasonable starting point |
| Node.js 20.9+ | Use the same major version as development |
| pnpm 10.18.3 | `corepack enable` |
| PostgreSQL 15+ | Managed service recommended |
| Nginx or equivalent | TLS termination and reverse proxy |
| Process supervisor | systemd, PM2 or the platform's process manager |

Optional but recommended: Redis 7 for scheduled tender collection. Without it, collection sources can only be run manually.

---

## 3. Build

On the build host or in CI:

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate

pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

Outputs:

- `apps/api/dist` - compiled NestJS API
- `apps/web/.next` - Next.js production build
- `database/dist` - compiled Prisma client wrapper

`NEXT_PUBLIC_*` values are baked into the web build. Set the production values before running `pnpm build`.

Do not run the build with development API URLs and then change them at runtime; rebuild the web app instead.

---

## 4. Environment

Create the production environment file or inject variables through the platform secret manager. See [CONFIGURATION.md](CONFIGURATION.md) for the full reference.

Minimum production set:

```dotenv
NODE_ENV=production

DATABASE_URL="postgresql://paktenders:<password>@<private-host>:5432/paktenders?schema=public&sslmode=require"

API_PORT=4000
API_PUBLIC_URL="https://api.paktenders.pk"
CORS_ORIGINS="https://paktenders.pk,https://www.paktenders.pk"
INTERNAL_API_KEY="<32-byte random secret shared with the web process>"
JWT_ACCESS_SECRET="<48-byte random secret>"
JWT_REFRESH_SECRET="<different 48-byte random secret>"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL_DAYS=30

NEXT_PUBLIC_SITE_URL="https://paktenders.pk"
NEXT_PUBLIC_API_URL="https://api.paktenders.pk"
API_INTERNAL_URL="http://127.0.0.1:4000"
SITE_URL="https://paktenders.pk"

SEED_ADMIN_EMAIL="admin@paktenders.pk"
SEED_ADMIN_PASSWORD="<strong bootstrap password>"
SEED_DEMO_DATA=false

# Collection (Redis required for scheduled runs)
REDIS_URL="redis://<private-redis>:6379"
BULLMQ_PREFIX="paktenders"
COLLECTION_ENABLED=true
COLLECTION_WORKER_ENABLED=true
COLLECTION_CONCURRENCY=4
OCR_ENABLED=true
OCR_LANGUAGES="eng,urd"
AI_COLLECTION_ENABLED=true
```

Rules:

- Use a different database role from the development one.
- Keep `sslmode=require` for managed databases.
- Never commit the production file.
- Rotate JWT secrets if they leak; all sessions become invalid.

---

## 5. Database

### Apply migrations

```bash
pnpm db:deploy
```

Use `db:deploy` (not `db:migrate`) in production. It applies committed migrations without generating new ones.

### Seed once

```bash
pnpm db:seed
```

Set `SEED_DEMO_DATA=false` in production. If the database was seeded during evaluation, remove sample tenders:

```bash
pnpm db:purge-demo
```

Verify:

```bash
psql "$DATABASE_URL" -c "select count(*) from tenders where \"isDemo\" = true;"
```

The result must be `0`.

### Backups

Take an encrypted daily backup and test restores regularly.

```bash
pg_dump "$DATABASE_URL" --format=custom --file="paktenders-$(date +%F).dump"
pg_restore --clean --if-exists --dbname="$DATABASE_URL" paktenders-2026-11-14.dump
```

Retain at least 14 daily backups and a monthly archive. Store them outside the database server.

### Migration safety

- Prisma migrations are forward-only. Review generated SQL before deploying.
- Take a backup before any migration that drops or rewrites columns.
- Run migrations before starting the new API version.
- Deploy API and web close together when an API contract changes.

---

## 6. Run the processes

### systemd example - API

`/etc/systemd/system/paktenders-api.service`

```ini
[Unit]
Description=Pak Tenders API
After=network.target postgresql.service

[Service]
Type=simple
User=paktenders
WorkingDirectory=/srv/paktenders/apps/api
EnvironmentFile=/srv/paktenders/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

### systemd example - web

`/etc/systemd/system/paktenders-web.service`

```ini
[Unit]
Description=Pak Tenders Web
After=network.target paktenders-api.service

[Service]
Type=simple
User=paktenders
WorkingDirectory=/srv/paktenders/apps/web
EnvironmentFile=/srv/paktenders/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now paktenders-api paktenders-web
sudo systemctl status paktenders-api paktenders-web
```

The API must run with `apps/api` as its working directory. The web app must run with `apps/web` as its working directory.

### PM2 alternative

```bash
pm2 start apps/api/dist/main.js --name paktenders-api --cwd apps/api
pm2 start node_modules/next/dist/bin/next --name paktenders-web --cwd apps/web -- start -p 3000
pm2 save
pm2 startup
```

---

## 7. Reverse proxy and TLS

### Nginx - website

```nginx
server {
    listen 443 ssl http2;
    server_name paktenders.pk www.paktenders.pk;

    ssl_certificate     /etc/letsencrypt/live/paktenders.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/paktenders.pk/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name paktenders.pk www.paktenders.pk;
    return 301 https://paktenders.pk$request_uri;
}
```

### Nginx - API

```nginx
server {
    listen 443 ssl http2;
    server_name api.paktenders.pk;

    ssl_certificate     /etc/letsencrypt/live/api.paktenders.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.paktenders.pk/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Notes:

- Terminate TLS at the proxy; the Node processes listen on loopback.
- The API sets `trust proxy` to one hop, so it must sit behind a trusted proxy and must not be exposed directly.
- Keep Swagger (`/api/docs`) available in staging. In production, restrict it by IP or disable it if policy requires.
- Add edge rate limiting as a second layer; the API already throttles per IP.
- Set `INTERNAL_API_KEY` to the same random value for both processes so website SSR traffic is excluded from the public per-IP limit.

---

## 8. First deployment checklist

- [ ] Production `.env` created with strong secrets
- [ ] Database created, private network access only, TLS enabled
- [ ] `pnpm db:deploy` succeeded
- [ ] Seed completed with `SEED_DEMO_DATA=false`
- [ ] `pnpm db:purge-demo` reports zero demo tenders
- [ ] `pnpm build` succeeded with production `NEXT_PUBLIC_*` values
- [ ] API starts and `/v1/health` returns `ok`
- [ ] Web starts and the home page renders live data
- [ ] TLS certificates valid and HTTP redirects to HTTPS
- [ ] `CORS_ORIGINS` contains only the real site origins
- [ ] Super Admin password changed from the seeded value
- [ ] Admin login works; `/admin/health` shows database connected
- [ ] Redis reachable and `/admin/collection/jobs` reports the queue ready (if scheduling is enabled)
- [ ] Collection worker running with `COLLECTION_WORKER_ENABLED=true`
- [ ] At least one verified source enabled and a manual run succeeds
- [ ] Document storage directory exists and is backed up (or S3 configured)
- [ ] Backup job scheduled and a restore has been tested
- [ ] Logs are collected and retained
- [ ] Optional providers are either configured or intentionally left disabled

---

## 9. Operations

### Health checks

| Check | Expected |
| --- | --- |
| `GET https://api.paktenders.pk/v1/health` | `status: ok`, `database: connected` |
| `GET https://paktenders.pk` | 200 with live content |
| `/admin/health` | API, database and provider statuses |
| `/admin/integrations` | Intended providers configured, others not configured |
| `/admin/collection/jobs` | Queue ready and no unexpected dead letters |

Point the load balancer or uptime monitor at `/v1/health`. Alert on non-200, `degraded`, or repeated restarts.

### Logs

- API logs to stdout/stderr; collect them with the process manager or platform.
- Unexpected server errors are also written to `error_logs` with a `requestId`.
- Admin actions are written to `audit_logs`.
- Never log tokens, passwords or provider credentials.

### Updates

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm db:deploy
sudo systemctl restart paktenders-api paktenders-web
```

Run the database migration before restarting the API. Restart the web app after the API is healthy.

### Rollback

1. Stop the web and API services.
2. Deploy the previous build artefacts.
3. Restore the database backup if the new release applied a destructive migration.
4. Start the API, confirm `/v1/health`, then start the web app.

Keep at least the previous two build artefacts available.

### Scaling

- Add API instances behind the proxy; sessions are stored in PostgreSQL.
- Add web instances; all state is in cookies and the API.
- Move rate limiting to a shared store if you run many API instances behind one IP-visible proxy.
- Run the collection worker in a single dedicated API instance first. Redis locks and deterministic job ids prevent double processing, but load-test before scaling workers across instances.
- Point document storage at S3 before running more than one worker host, so every instance can read stored files.

---

## 10. Security checklist

- [ ] HTTPS everywhere, HSTS enabled
- [ ] `NODE_ENV=production`
- [ ] Unique 48-byte JWT secrets, stored in a secret manager
- [ ] Database password rotated from any development value
- [ ] PostgreSQL not publicly reachable
- [ ] Firewall allows only 80/443 publicly; 3000/4000/5432 are private
- [ ] `CORS_ORIGINS` restricted to production origins
- [ ] Seeded Super Admin password changed
- [ ] Demo tenders removed
- [ ] Swagger restricted or disabled if required
- [ ] Backups encrypted and restore-tested
- [ ] Dependency updates reviewed
- [ ] Error logs monitored for repeated 5xx responses
- [ ] Audit log reviewed after administrative changes

---

## 11. Not included in Phase 1

- Docker images and compose files
- Kubernetes manifests
- CI/CD pipeline definitions
- Queue dashboards (BullMQ is inspected through `/admin/collection/jobs`)
- CDN configuration for static assets
- WAF rules and DDoS protection
- Log aggregation stack

These are deployment concerns that can be added without application changes. Background collection only needs a configured `REDIS_URL` and `COLLECTION_WORKER_ENABLED=true`; without them, collection stays manual.
