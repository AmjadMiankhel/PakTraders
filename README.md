# Pak Tenders

Tender discovery and procurement intelligence for Pakistan.

Pak Tenders is a production-oriented monorepo that powers the public website, the REST API and the Super Admin Control Center. It is built to stay fully usable when optional integrations (AI, payments, email, push, object storage) are not configured.

- Public site: `http://localhost:3000`
- REST API: `http://localhost:4000/v1`
- OpenAPI / Swagger: `http://localhost:4000/api/docs`

---

## Phase 1 status

| Area | Status |
| --- | --- |
| PostgreSQL schema, migrations, seed | Complete |
| NestJS REST API with auth, RBAC, tenders, catalog, stats, account, admin | Complete |
| Next.js public website (tenders, categories, locations, departments, pricing, legal, SEO) | Complete |
| Registration, login, password reset, session refresh | Complete |
| User dashboard (saved tenders, saved searches, alerts, notifications, profile, subscription) | Complete |
| Super Admin Control Center (tenders, users, settings, integrations, audit, health) | Complete |
| Automated tender collection (connectors, scheduling, OCR, dedupe, review) | Complete — see [docs/COLLECTION.md](docs/COLLECTION.md) |
| React Native / Expo mobile apps | Planned for Phase 2 |
| Chatbot runtime, payments, email, push, S3 uploads | Built as disabled integrations; waiting on credentials |

The mobile applications and live provider integrations are intentionally not part of Phase 1. Nothing in the current product pretends those services exist: disabled features are labelled in the UI and in the admin console. The collection module is real and running; it only enables sources whose public listings were verified as reachable and permitted.

---

## Stack

| Layer | Technology |
| --- | --- |
| Website | Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4 |
| API | NestJS 12, class-validator, Zod, Swagger |
| Database | PostgreSQL 15+, Prisma 6 |
| Queue / scheduling | Redis 7+, BullMQ (optional; collection runs synchronously without it) |
| Collection | Cheerio, fast-xml-parser, csv-parse, pdf-parse, Tesseract OCR (`eng+urd`), pdf-to-img, imapflow |
| Auth | JWT access + rotating refresh tokens in httpOnly cookies, Argon2id password hashing |
| Monorepo | pnpm 10 workspaces + Turborepo |
| Shared packages | design tokens, shared types, utilities, validation, config, API client |

Everything is TypeScript. All timestamps are stored in UTC and rendered in `Asia/Karachi` (PKT, UTC+5). Currency is PKR.

---

## Repository layout

```
apps/
  web/                 Next.js website and admin console
  api/                 NestJS REST API
database/              Prisma schema, migrations, seed, demo purge
packages/
  api-client/          Typed API client helpers
  config/              Server environment parsing (Zod)
  design-tokens/       Shared colours, spacing and typography tokens
  shared-types/        API DTO types shared by web and API
  shared-utils/        PKT date, PKR currency and formatting helpers
  validation/          Zod schemas used by API and forms
docs/                  Architecture, setup, configuration, API, deployment, collection, phase reports
```

---

## Quick start

### Prerequisites

- Node.js 20.9 or newer (verified with Node 24.22.3)
- pnpm 10.18.3 (`corepack enable` then `corepack prepare pnpm@10.18.3 --activate`)
- PostgreSQL 15 or newer (verified with PostgreSQL 17.6)
- Optional: Redis 7 for scheduled collection and background jobs

### 1. Configure environment

```bash
cp .env.example .env
```

Then edit `.env`. At minimum set `DATABASE_URL`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The root `.env` is the single source of truth for both apps.

### 2. Create the database

```sql
CREATE ROLE paktenders LOGIN PASSWORD 'paktenders';
CREATE DATABASE paktenders OWNER paktenders;
```

### 3. Install, migrate and seed

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

`pnpm db:migrate` is available for development when you change the schema.

### 4. Run

Development:

```bash
pnpm dev            # API + web in watch mode
# or individually
pnpm dev:api
pnpm dev:web
```

Production build locally:

```bash
pnpm build
pnpm --filter @paktenders/api start
pnpm --filter @paktenders/web start
```

Open `http://localhost:3000`. The seeded Super Admin is:

```
Email:    admin@paktenders.pk
Password: ChangeMe!PakTenders2026
```

Change this password before any real deployment.

---

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run API and web together with Turborepo |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm start` | Start built API and web |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Create/apply a development migration |
| `pnpm db:deploy` | Apply committed migrations (production) |
| `pnpm db:seed` | Seed reference data, plans, settings, RBAC and demo tenders |
| `pnpm db:purge-demo` | Delete every record with `isDemo = true` |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm format` | Format with Prettier |

---

## Demo data

The seed creates 14 sample tenders so the UI can be evaluated. They are never presented as real opportunities:

- `isDemo = true` and `verificationStatus = DEMO`
- titles prefixed with `[Demo]`
- source attribution states the record is not a real notice
- the public UI shows a demo badge and an explanatory note
- `GET /v1/stats` reports `demoRecords`

Remove them before launch:

```bash
pnpm db:purge-demo
```

Reference data (provinces, cities, categories, departments, sources, plans, settings, roles) is preserved.

---

## Tender collection

The collection module pulls tenders from official sources, stores permitted
documents, extracts fields with deterministic rules and optional OCR/AI, detects
duplicates and sends uncertain records to a human review queue.

- **Enabled sources (verified reachable):** PPRA EPMS, AJK PPRA, GB PPRA, plus
  manual editorial entry.
- **Configured but disabled:** KPPRA (host unreachable at setup), SPPRA, BPPRA,
  PPRA Punjab (unreachable/erroring) and newspaper classifieds (licence needed).
  Their access reasons are recorded in the source registry.
- **Scheduling:** BullMQ with Redis locks, exponential backoff, a dead-letter
  queue and daily reconciliation. Without Redis, **Run now** still works
  synchronously.
- **Admin:** `/admin/collection` — overview, sources, runs, review queue,
  duplicates, manual import, queue and errors.

Full details: [docs/COLLECTION.md](docs/COLLECTION.md). Verification and
limitations: [docs/COLLECTION-REPORT.md](docs/COLLECTION-REPORT.md).

---

## Optional integrations

Missing credentials produce a built-but-disabled integration. The platform remains functional without:

- AI provider / chatbot
- JazzCash, Easypaisa, card gateway
- transactional email
- Expo push / FCM / APNs
- S3-compatible object storage
- Redis / BullMQ (scheduled collection stops; manual runs still work)
- GA4 / GTM analytics

Configure them through environment variables and mark their status in the admin console. Credentials are never exposed by the API. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Local setup](docs/SETUP.md)
- [Configuration and environment variables](docs/CONFIGURATION.md)
- [API reference](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Hostinger deployment](docs/HOSTINGER.md)
- [Tender collection](docs/COLLECTION.md)
- [Collection completion report](docs/COLLECTION-REPORT.md)
- [Phase 1 completion report](docs/PHASE-1-REPORT.md)

---

## Security notes

- Access tokens live for 15 minutes; refresh tokens rotate on every use and are stored hashed in the database.
- Browser tokens are httpOnly, SameSite=Lax and `Secure` in production (except an explicitly configured local HTTP origin).
- Passwords are hashed with Argon2id. Login and auth endpoints are rate limited.
- Admin mutations are written to the audit log. Integration secrets are never returned by the API.
- Never commit `.env`. Use a secret manager in production.
