# Phase 1 completion report

Date: 14 November 2026

Project: Pak Tenders (paktenders.pk)
Scope: Website, REST API, database, authentication, user dashboard and Super Admin Control Center.

---

## 1. Summary

Phase 1 delivers a working, production-oriented platform for browsing Pakistani tender opportunities and operating the catalog behind an admin console. The public site, API, database schema, authentication, user dashboard and admin workflows are implemented and verified end to end.

The platform does not depend on optional providers. AI, payments, email, push, object storage and Redis are represented as integrations that stay disabled until credentials are supplied. No demo record is presented as a real tender.

Phase 1 is **not** the full product: mobile apps, the chatbot runtime, payment checkout, email delivery and background workers remain for later phases.

---

## 2. Completed features

### 2.1 Public website

| Feature | Status |
| --- | --- |
| Home page with live stats, latest tenders, closing-soon list and categories | Complete |
| Tender search with keyword, category, province, city, department, type, closing window and sort | Complete |
| Tender detail with description, eligibility, documents, contact details, source attribution, related tenders, print and save | Complete |
| Category index and filtered category pages | Complete |
| Province index, city lists and filtered location pages | Complete |
| Department directory and filtered department pages | Complete |
| Pricing page driven by database plans and PKR amounts | Complete |
| About, contact, privacy, terms and disclaimer pages | Complete |
| Responsive header/footer, mobile navigation and accessible form controls | Complete |
| Custom 404, error and loading states | Complete |
| Per-page metadata, canonicals, Open Graph, Organization JSON-LD | Complete |
| `sitemap.xml` and `robots.txt` generated from live data with fallbacks | Complete |
| Demo badge and explanatory note on sample records | Complete |
| Announcement bar and support details from admin-editable public settings | Complete |

### 2.2 Authentication

| Feature | Status |
| --- | --- |
| Registration with validation and terms acceptance | Complete |
| Login with Argon2id verification | Complete |
| Access and refresh tokens in httpOnly cookies | Complete |
| Refresh rotation and session revocation | Complete |
| Forgot-password request and reset-password flow | Complete |
| Protected-route proxy with token refresh and redirect | Complete |
| Account status checks (suspended/deleted accounts blocked) | Complete |
| Rate limiting on auth routes | Complete |
| Logout and logout-all | Complete |

### 2.3 User dashboard

| Feature | Status |
| --- | --- |
| Overview with profile, plan and recent activity | Complete |
| Saved tenders with save/unsave | Complete |
| Saved searches create/delete | Complete |
| Alert rules create, toggle and delete | Complete |
| In-app notifications and mark-as-read | Complete |
| Profile editing | Complete |
| Preferences (theme, language, channels, digest, quiet hours) | Complete |
| Subscription and invoice overview | Complete |
| Account deletion with confirmation | Complete |

### 2.4 Super Admin Control Center

| Feature | Status |
| --- | --- |
| Role-gated layout with staff navigation | Complete |
| Overview: tenders, users, finance, notifications, errors and recent audit | Complete |
| Tender list with status and verification filters | Complete |
| Tender create/edit form with province-city cascade and PKT datetime handling | Complete |
| Publish, close, cancel, archive and verify workflows | Complete |
| Soft delete | Complete |
| User search, status change and session revocation on suspension | Complete |
| JSON settings editor with audit trail | Complete |
| Integration status console without credential exposure | Complete |
| Audit log viewer | Complete |
| System health page (API, database, Redis, email, AI, storage, push, payments) | Complete |

### 2.5 API and data

| Feature | Status |
| --- | --- |
| NestJS API with `/v1` prefix and Swagger at `/api/docs` | Complete |
| 65-model Prisma schema and two applied migrations | Complete |
| Seed for geography, catalog, departments, sources, plans, RBAC, settings, integrations, knowledge base, blog and demo tenders | Complete |
| Public catalog, stats, plans, tender search/detail/similar and settings endpoints | Complete |
| Account endpoints for saved items, searches, alerts, notifications, profile, subscription and invoices | Complete |
| Admin endpoints for overview, users, settings, integrations, audit, health and tender CRUD | Complete |
| Consistent error envelope with request IDs and error logging | Complete |
| Helmet, CORS allowlist, validation pipe, throttling and global exception filter | Complete |
| Audit logging for administrative mutations | Complete |
| Demo purge script | Complete |

---

## 3. Modules and key files

### API

| Path | Responsibility |
| --- | --- |
| `apps/api/src/main.ts` | Bootstrap, security middleware, CORS, Swagger, proxy trust |
| `apps/api/src/app.module.ts` | Module wiring, global guards, rate limits, internal SSR bypass |
| `apps/api/src/modules/auth` | Registration, login, refresh, logout, password reset, current user |
| `apps/api/src/modules/tenders` | Public search, detail, similar, admin CRUD and workflow |
| `apps/api/src/modules/catalog` | Categories, provinces, departments, sources, public settings |
| `apps/api/src/modules/stats` | Live platform counts |
| `apps/api/src/modules/plans` | Subscription plans |
| `apps/api/src/modules/me` | Profile, preferences, saved items, alerts, notifications, billing views, deletion |
| `apps/api/src/modules/admin` | Overview, users, settings, integrations, audit, health |
| `apps/api/src/modules/health` | Liveness and database probe |
| `apps/api/src/common` | Prisma service, guards, decorators, Zod pipe, exception filter |
| `database/prisma/schema.prisma` | Full data model |
| `database/prisma/migrations` | `20261113184630_init`, `20261113190000_search_indexes` |
| `database/prisma/seed.ts` | Idempotent reference and demo seed |
| `database/prisma/purge-demo.ts` | Removes all `isDemo` records |

### Web

| Path | Responsibility |
| --- | --- |
| `apps/web/src/app` | Public, auth, dashboard and admin routes |
| `apps/web/src/app/api/auth` | Cookie-setting auth route handlers |
| `apps/web/src/proxy.ts` | Token refresh and protected-route redirects |
| `apps/web/src/lib/server-api.ts` | Server-side API client with fallbacks and internal key |
| `apps/web/src/lib/actions.ts` | Server actions for every mutation, PKT datetime normalisation |
| `apps/web/src/lib/auth-cookies.ts` | Cookie names, options and JWT expiry checks |
| `apps/web/src/lib/public-settings.ts` | Admin-editable public settings with defaults |
| `apps/web/src/components` | UI primitives, layout, tenders, forms and admin components |
| `apps/web/src/app/sitemap.ts`, `robots.ts` | SEO routes |
| `apps/web/src/app/globals.css` | Tailwind 4 theme and component classes |

### Shared packages

`design-tokens`, `shared-types`, `shared-utils`, `validation`, `config` and `api-client`.

---

## 4. Data state after seed

| Data | Count |
| --- | --- |
| Provinces | 7 |
| Cities | 39 |
| Categories | 23 |
| Departments | 33 |
| Procurement authorities | 5 |
| Newspapers | 5 |
| Tender sources | 9 |
| Subscription plans | 5 |
| Roles | 14 (13 staff roles plus user) |
| Permissions | 27 |
| System settings | 15 |
| Integration records | 10 |
| Chatbot knowledge articles | 6 |
| Blog categories | 3 |
| Blog posts | 3 |
| Demo tenders | 14 |

Demo tenders are `isDemo = true`, `verificationStatus = DEMO`, titled `[Demo]` and attributed as sample data. `GET /v1/stats` reports `demoRecords`.

---

## 5. Verification performed

### 5.1 Build and type checks

| Command | Result |
| --- | --- |
| `pnpm --filter @paktenders/api typecheck` | Passed |
| `pnpm --filter @paktenders/api build` | Passed |
| `pnpm --filter @paktenders/web typecheck` | Passed |
| `pnpm --filter @paktenders/web build` | Passed; Next.js compiled and generated all routes |

PowerShell reports some pnpm/Next output on stderr as `NativeCommandError`. Exit codes and build artefacts confirmed success.

### 5.2 API smoke tests

| Check | Result |
| --- | --- |
| `GET /v1/health` | `200`, `status: ok`, `database: connected` |
| `GET /v1/stats` | `200`, 14 published, 14 demo, 23 categories, 33 departments, 9 sources |
| `GET /v1/tenders?pageSize=3` | `200`, `items` and `meta` returned |
| `GET /v1/tenders?status=DRAFT` | `200`, all returned records `PUBLISHED`; drafts are not exposed |
| `GET /v1/categories` | `200`, 23 records |
| `GET /v1/locations/provinces` | `200`, 7 records |
| `GET /v1/departments` | `200`, 33 records |
| `GET /v1/plans` | `200`, 5 records |
| `GET /v1/settings/public` | `200`, public keys only |
| `GET /v1/sources` | `200`, 9 records |
| `POST /v1/auth/login` | `200`, Super Admin roles returned |
| `GET /v1/auth/me` | `200` |
| `/v1/me/profile`, `notifications`, `saved-tenders`, `alerts`, `saved-searches`, `subscription`, `invoices` | `200` |
| `/v1/admin/overview`, `integrations`, `health`, `settings`, `users`, `audit-logs`, `tenders` | `200` |

### 5.3 End-to-end flows verified during Phase 1

- Registration with a temporary user, dashboard access, then account deletion through the API.
- Login through `/api/auth/login` sets `pt_access` and `pt_refresh`; logout clears them.
- Admin tender create, edit, publish, verify, soft delete and confirmed 404 after deletion.
- Save and unsave a tender; create and delete a saved search; create, toggle and delete an alert; update preferences.
- Empty subscription body handled without a page error.
- Admin settings update with audit entry.
- Suspended and deleted accounts cannot authenticate.

### 5.4 Web page checks

All returned `200`:

Public: `/`, `/tenders`, `/categories`, `/categories/construction-civil-engineering`, `/locations`, `/locations/punjab`, `/departments`, `/departments/pakistan-public-works-department`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`, `/disclaimer`, `/sitemap.xml`, `/robots.txt`.

Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`.

Authenticated dashboard: `/dashboard`, `/saved`, `/searches`, `/alerts`, `/notifications`, `/profile`, `/subscription`.

Authenticated admin: `/admin`, `/admin/tenders`, `/admin/tenders/new`, `/admin/users`, `/admin/settings`, `/admin/integrations`, `/admin/audit`, `/admin/health`.

### 5.5 Issues found and fixed during final verification

| Issue | Resolution |
| --- | --- |
| Public tender list accepted a `status` query parameter and could return non-published records | Public listing now always filters `PUBLISHED` |
| Website SSR calls shared one per-IP rate-limit bucket with all visitors | Added optional `INTERNAL_API_KEY`; SSR requests skip public throttling while external traffic stays limited |
| API behind a proxy would see the proxy IP for every client | Enabled one-hop `trust proxy` so per-IP limits use `X-Forwarded-For` |
| Search placeholder implied department search although the query covers title, description and reference | Placeholder corrected |
| Account deletion with the wrong confirmation returned 404 | Now returns 400 |
| Local PostgreSQL process ended during verification | Restarted; application behaviour was correct |

---

## 6. Remaining tasks

### Phase 2 - mobile

- React Native / Expo apps with Expo Router
- Shared API client integration
- Push token registration and notification handling
- App configuration and announcements consumption
- Store submission assets and release process

### Phase 2 - operations

- Redis/BullMQ workers for imports, alerts and notification delivery
- Scheduled tender import pipeline and source adapters
- Email delivery and verification templates
- Push delivery through Expo/FCM/APNs
- S3 document upload, virus scanning and download tracking
- Automated backup and restore verification

### Phase 2 - product

- Chatbot API and UI using the seeded knowledge base
- Payment checkout and webhook handling
- Subscription activation, renewal and invoice PDFs
- Company/team accounts and member management
- Support ticket API and UI
- Blog and editorial pages with public API
- Admin screens for plans, categories, departments, content, roles, support and billing
- Urdu interface localization
- Advanced search ranking and saved-search alert evaluation
- Automated test suite (unit, integration and end-to-end)
- Docker, CI/CD and infrastructure as code

---

## 7. Missing credentials and integrations

| Integration | Missing configuration | Current behaviour |
| --- | --- | --- |
| Transactional email | `EMAIL_PROVIDER`, API key or SMTP credentials | No verification or reset email; reset link logged in development only |
| AI / chatbot | `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | Chatbot disabled; knowledge content available |
| JazzCash | Merchant ID, password, integrity salt | Checkout disabled |
| Easypaisa | Store ID, hash key | Checkout disabled |
| Card gateway | Key and secret | Checkout disabled |
| Expo push | `EXPO_ACCESS_TOKEN` | In-app notifications only |
| FCM / APNs | Server key, key ID, team ID, private key | No external push |
| S3 storage | Endpoint, bucket, keys, public base URL | Document metadata only; no uploads |
| Redis / BullMQ | `REDIS_URL` | No background jobs |
| WhatsApp Business | Provider credentials | Not available |
| SMS gateway | Provider credentials | Not available |
| Analytics | GA4 / GTM IDs | No analytics scripts |
| Domain and TLS | DNS, certificates | Local HTTP only |

Also outstanding:

- The seeded Super Admin password must be changed.
- Demo tenders must be purged before launch.
- A production `INTERNAL_API_KEY` should be generated.
- The working directory is not a Git repository; initialise one before team collaboration.

---

## 8. Deployment requirements

1. Node.js 20.9+ and pnpm 10.18.3 on the build host.
2. PostgreSQL 15+ with a dedicated role, strong password, private network access and TLS.
3. Root `.env` or secret-manager injection with:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `API_PUBLIC_URL`, `CORS_ORIGINS`
   - `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, `SITE_URL`
   - `INTERNAL_API_KEY`
4. `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm build`.
5. `pnpm db:deploy` before starting the new API version.
6. Seed with `SEED_DEMO_DATA=false`, then `pnpm db:purge-demo`.
7. Run the API from `apps/api` and the web app from `apps/web`.
8. Reverse proxy with TLS, HSTS and one trusted proxy hop; do not expose the API or PostgreSQL directly.
9. Process supervision (systemd or PM2) with restart-on-failure.
10. Daily encrypted database backups with tested restores.
11. Uptime monitoring against `/v1/health` and log collection.
12. Change the Super Admin password immediately after first login.

No Dockerfiles, Kubernetes manifests or CI pipeline are included in Phase 1.

---

## 9. Known limitations

### Product scope

- Mobile apps are not built.
- The chatbot has no runtime, API or UI yet.
- Payments are not processed; paid plans require manual activation.
- Email is not delivered; password reset links only appear in the development log.
- Email verification is not enforced; users are created `ACTIVE` with `emailVerifiedAt = null`.
- Push notifications, S3 uploads and Redis workers are not active.
- Company/team accounts and support tickets exist in the schema but have no API or UI.
- Blog content is seeded but there are no public blog pages or blog API.
- Invoice PDF generation and data export are not implemented.

### Behaviour

- Tender search uses case-insensitive SQL `contains` over title, description and reference number. `relevance` sort falls back to featured/newest; there is no full-text ranking.
- The sitemap includes at most 50 pages of 100 tenders (5,000 records) per generation.
- `site.maintenanceMode`, `features.subscriptions` and `features.tenderPublishing` are stored but not enforced. `features.registration` is enforced on the registration page.
- Admin console covers tenders, users, settings, integrations, audit and health. It does not yet manage plans, categories, departments, content, roles, billing or support.
- Admin tender editing covers core fields; document upload and tender update timelines are not exposed in the UI.
- In-app alerts are stored but not evaluated on a schedule.
- The API and web processes are single-instance friendly but there is no shared rate-limit store beyond the in-memory throttler.
- No CAPTCHA or account lockout beyond rate limiting.
- English only; the layout is prepared for Urdu but no translations are shipped.
- No automated tests exist. Verification is manual through the build, API and page checks above.
- The project has no Git history in the current working directory.

### Environment

- Local development uses portable Node and PostgreSQL binaries without administrator rights. See [SETUP.md](SETUP.md) for the exact paths.
- Local PostgreSQL and API processes are not registered as services; they must be restarted after a machine reboot.

---

## 10. Handover state

| Service | Address | State |
| --- | --- | --- |
| Website | `http://localhost:3000` | Running |
| API | `http://localhost:4000/v1` | Running |
| Swagger | `http://localhost:4000/api/docs` | Available |
| PostgreSQL | `127.0.0.1:5432` | Running |

Documentation:

- [README](../README.md)
- [Architecture](ARCHITECTURE.md)
- [Setup](SETUP.md)
- [Configuration](CONFIGURATION.md)
- [API reference](API.md)
- [Deployment](DEPLOYMENT.md)

Phase 1 is complete for the agreed web, API, database, dashboard and admin scope. The next phase should start with automated tests and the mobile client, then enable providers as credentials become available.
