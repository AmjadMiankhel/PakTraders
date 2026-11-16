# Local setup

This guide takes a clean machine to a running Pak Tenders stack: PostgreSQL, the NestJS API on port 4000 and the Next.js website on port 3000.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.9+ | Verified with Node 24.22.3 |
| pnpm | 10.18.3 | Enable through Corepack |
| PostgreSQL | 15+ | Verified with PostgreSQL 17.6 |
| Redis | 7 (optional) | Required for scheduled tender collection; without it collection runs only when triggered manually |
| Git | any | Optional; the project can run without a repository |

Enable pnpm:

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm --version
```

Windows PowerShell note: if script execution is restricted, call `pnpm.cmd` and `npm.cmd` instead of the `.ps1` shims.

---

## 2. Environment file

The repository uses one root `.env` for both apps.

```bash
cp .env.example .env
```

Minimum values to change:

```dotenv
DATABASE_URL="postgresql://paktenders:paktenders@127.0.0.1:5432/paktenders?schema=public"
JWT_ACCESS_SECRET="<random string of at least 32 characters>"
JWT_REFRESH_SECRET="<a different random string of at least 32 characters>"
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

For local development the remaining defaults work as-is. See [CONFIGURATION.md](CONFIGURATION.md) for every variable.

How the file is loaded:

- API: `ConfigModule` with `envFilePath: ["../../.env", ".env"]` plus `apps/api/src/env.ts`.
- Web: `next.config.ts` loads `../../.env` and then `.env.local` with override.
- Prisma scripts: `dotenv run -f ../.env -- prisma ...`, so migrations and seeds always use the root file.

---

## 3. PostgreSQL

### Create the role and database

Using `psql` as a superuser:

```sql
CREATE ROLE paktenders LOGIN PASSWORD 'paktenders';
CREATE DATABASE paktenders OWNER paktenders;
```

Or from a shell:

```bash
psql -U postgres -c "CREATE ROLE paktenders LOGIN PASSWORD 'paktenders';"
psql -U postgres -c "CREATE DATABASE paktenders OWNER paktenders;"
```

Check the connection:

```bash
psql "postgresql://paktenders:paktenders@127.0.0.1:5432/paktenders" -c "select version();"
```

For production, use a managed PostgreSQL instance, a strong password and TLS (`sslmode=require`).

---

## 4. Install and initialise

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

What each step does:

- `pnpm install` installs every workspace and runs approved native builds.
- `pnpm db:generate` generates the Prisma client into `database/node_modules/@prisma/client`.
- `pnpm db:deploy` applies the committed migrations (`init`, `search_indexes` and the two collection migrations).
- `pnpm db:seed` inserts reference data, RBAC roles, plans, settings, integrations, knowledge articles, blog posts, the tender source registry (11 sources) and 14 flagged demo tenders.

Use `pnpm db:migrate` instead of `db:deploy` when you are changing `schema.prisma` locally and want a new migration file.

### Seed configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `SEED_ADMIN_EMAIL` | `admin@paktenders.pk` | Super Admin login |
| `SEED_ADMIN_PASSWORD` | `ChangeMe!PakTenders2026` | Super Admin password |
| `SEED_DEMO_DATA` | `true` | Creates the flagged demo tenders |

Change the admin password after first login, or set a strong value before seeding.

---

## 5. Run the stack

### Development (watch mode)

```bash
pnpm dev
```

This runs `turbo run dev --parallel`, starting the API with `nest start --watch` and the web app with `next dev`.

Individually:

```bash
pnpm dev:api
pnpm dev:web
```

### Production build locally

```bash
pnpm build
pnpm --filter @paktenders/api start
pnpm --filter @paktenders/web start
```

The API must run with `apps/api` as its working directory because its `ConfigModule` resolves `../../.env` from the process cwd and the start script points at `dist/main.js`. The root `pnpm start` handles this through the workspace script.

### URLs

| Service | URL |
| --- | --- |
| Website | http://localhost:3000 |
| API | http://localhost:4000/v1 |
| Health | http://localhost:4000/v1/health |
| Swagger UI | http://localhost:4000/api/docs |

---

## 6. Verify the installation

```bash
curl http://localhost:4000/v1/health
curl http://localhost:4000/v1/stats
curl http://localhost:4000/v1/tenders?pageSize=3
curl http://localhost:4000/v1/categories
curl http://localhost:4000/v1/plans
```

Expected results:

- `/v1/health` returns `{"status":"ok","database":"connected",...}`.
- `/v1/stats` returns live counts. `demoRecords` should be 14 after seeding.
- `/v1/tenders` returns a paginated `items` array and `meta`.
- The website home page renders stats, latest tenders and categories.

Sign in at `http://localhost:3000/login` with the seeded admin, then open:

- `/dashboard` - user overview
- `/admin` - Super Admin Control Center
- `/admin/tenders` - tender list
- `/admin/settings` - JSON settings editor
- `/admin/integrations` - provider status
- `/admin/health` - database and provider health

---

## 7. Windows portable toolchain (this environment)

The current development machine has no administrator rights, so Node, pnpm and PostgreSQL are installed under `%LOCALAPPDATA%`.

| Tool | Path |
| --- | --- |
| Node | `C:\Users\ok\AppData\Local\paktenders-tools\node-v24.22.3-win-x64` |
| pnpm | Activated with Corepack from that Node installation |
| PostgreSQL binaries | `C:\Users\ok\AppData\Local\paktenders-tools\pg\pgsql\bin` |
| PostgreSQL data | `C:\Users\ok\AppData\Local\paktenders-tools\pgdata` |

Start PostgreSQL:

```powershell
$env:Path = "$env:LOCALAPPDATA\paktenders-tools\node-v24.22.3-win-x64;" + $env:Path
& "$env:LOCALAPPDATA\paktenders-tools\pg\pgsql\bin\pg_ctl.exe" `
  -D "$env:LOCALAPPDATA\paktenders-tools\pgdata" `
  -l "$env:LOCALAPPDATA\paktenders-tools\pg-server.log" `
  -o "-p 5432" start
```

If PostgreSQL refuses to start after an unclean shutdown, remove the stale lock file:

```powershell
Remove-Item "$env:LOCALAPPDATA\paktenders-tools\pgdata\postmaster.pid" -Force
```

Start the API and web app in separate windows:

```powershell
# API
Set-Location apps\api
node dist\main.js

# Web
Set-Location apps\web
node node_modules\next\dist\bin\next start -p 3000
```

---

## 8. Database maintenance

### Apply schema changes

```bash
# development: create a migration from schema.prisma
pnpm db:migrate

# production: apply committed migrations only
pnpm db:deploy
```

### Inspect data

```bash
pnpm db:studio
```

### Remove demo tenders

```bash
pnpm db:purge-demo
```

This deletes records with `isDemo = true` and cascades their documents, updates and history. Reference data is untouched.

### Reset everything locally

```bash
psql "postgresql://paktenders:paktenders@127.0.0.1:5432/paktenders" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm db:deploy
pnpm db:seed
```

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `JWT_ACCESS_SECRET must be at least 32 characters` | Placeholder or short secret | Generate a 48-byte secret |
| API exits at boot with `Invalid environment configuration` | Missing `DATABASE_URL` or JWT secrets | Fill the root `.env` |
| `Can't reach database server` | PostgreSQL not running or wrong port | Start PostgreSQL, check `DATABASE_URL` |
| `P1001` during migrations | Same as above | Verify with `psql` |
| Website loads but data sections are empty | API is down or on another port | Check `API_INTERNAL_URL`, open `/v1/health` |
| Login succeeds but dashboard redirects to `/login` | Cookies rejected | Use the same hostname (`localhost` vs `127.0.0.1`), check `NEXT_PUBLIC_SITE_URL` |
| Admin pages redirect to `/dashboard` | Signed-in user lacks a staff role | Use the seeded Super Admin |
| `pnpm` cannot be loaded because scripts are disabled | PowerShell execution policy | Use `pnpm.cmd` |
| Next build reports exit code 1 but completes | PowerShell treats stderr as an error | Confirm the build output and `.next` directory |
| `EADDRINUSE` | Port 3000 or 4000 already in use | Stop the old process or change the port |
| Stale `postmaster.pid` | PostgreSQL killed uncleanly | Remove the file and restart |

### Port checks

```powershell
Get-NetTCPConnection -LocalPort 3000,4000,5432 -State Listen |
  Select-Object LocalPort, OwningProcess
```

---

## 10. First-run checklist

- [ ] `.env` exists and is not committed
- [ ] PostgreSQL is running and reachable
- [ ] Migrations applied
- [ ] Seed completed
- [ ] API health returns `ok`
- [ ] Website home page renders live data
- [ ] Super Admin can sign in and open `/admin`
- [ ] Super Admin password changed
- [ ] Demo tenders purged or explicitly accepted for evaluation
