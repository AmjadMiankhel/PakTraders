# Architecture

This document describes how the Pak Tenders monorepo is put together: the runtime topology, request flows, data model, API surface, web routes and the design rules that keep the platform usable when optional services are missing.

---

## 1. Runtime topology

```
                    +-----------------------------+
                    |        Browser              |
                    |  public site / dashboard    |
                    |  admin console              |
                    +--------------+--------------+
                                   |
                     HTTPS         |  httpOnly cookies (pt_access, pt_refresh)
                                   v
                    +-----------------------------+
                    |   apps/web (Next.js 16)     |
                    |   RSC pages + route handlers|
                    |   proxy.ts (token refresh)  |
                    +--------------+--------------+
                                   |
                     Server-side  |  Authorization: Bearer <access token>
                     fetch        v
                    +-----------------------------+
                    |   apps/api (NestJS 12)      |
                    |   /v1/*  +  /api/docs       |
                    |   collection worker         |
                    +--------------+--------------+
                                   |
                                   | Prisma 6
                                   v
                    +-----------------------------+
                    |      PostgreSQL 15+         |
                    +-----------------------------+

Collection (optional Redis):
  apps/api worker  <-- BullMQ -->  Redis 7+  (queues, locks, schedules)
        |
        +--> public source websites (rate-limited, robots-aware, SSRF-guarded)
        +--> local document storage (or S3 when configured)
        +--> optional AI provider for classification only

Optional, disabled by default:
  AI provider   - chatbot runtime and AI classification
  S3            - document storage
  Email/Push    - notification delivery
  Payment gates - JazzCash / Easypaisa / cards
```

The web app never talks to PostgreSQL directly. All reads and writes go through the API, so the same contracts can serve the Phase 2 mobile apps.

---

## 2. Workspaces

| Workspace | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router site, auth route handlers, dashboard, admin console, SEO routes |
| `apps/api` | NestJS REST API, auth, RBAC, business logic, OpenAPI document |
| `database` | Prisma schema, migrations, seed, demo purge, shared `PrismaClient` |
| `packages/config` | Zod-validated server environment, CORS origin parsing |
| `packages/validation` | Zod schemas shared by API DTO validation and client forms |
| `packages/shared-types` | API response and DTO types |
| `packages/shared-utils` | PKT date formatting, PKR currency, slugs, initials, duration parsing |
| `packages/design-tokens` | Colour, radius, spacing and typography tokens |
| `packages/api-client` | Small typed fetch wrapper for consumers |

Turborepo builds packages before apps (`dependsOn: ["^build"]`). The root `.env` is loaded by the API through `dotenv`/`ConfigModule` and by Next.js through `next.config.ts`.

---

## 3. Authentication and session flow

### Registration and login

1. The browser posts to a Next.js route handler (`/api/auth/register` or `/api/auth/login`).
2. The route handler calls the API (`POST /v1/auth/register` / `POST /v1/auth/login`).
3. The API hashes/verifies the password with Argon2id and returns `{ user, tokens: { accessToken, refreshToken, expiresIn } }`.
4. The Next.js handler stores the tokens in httpOnly cookies:
   - `pt_access` - 15 minutes
   - `pt_refresh` - 30 days
5. The API itself never sets cookies; it is usable by the future mobile clients with bearer tokens.

### Protected page render

1. `apps/web/src/proxy.ts` matches `/dashboard/:path*` and `/admin/:path*`.
2. If the access token is missing or within 30 seconds of expiry, the proxy calls `POST /v1/auth/refresh` with the refresh token.
3. On success it writes rotated cookies and forwards the request with the new access token.
4. On failure it clears both cookies and redirects to `/login?next=<path>`.
5. The page/layout also calls `GET /v1/auth/me`; the admin layout additionally checks roles.

The API remains the source of truth. Proxy checks are a UX optimisation, not the authorisation boundary.

### Tokens and sessions

- Refresh tokens are random 48-byte values. Only their SHA-256 hash is stored in `Session.refreshTokenHash`.
- Refresh rotation revokes the previous session record and creates a new one.
- `POST /v1/auth/logout` revokes the current refresh token; `logout-all` revokes every session for the user.
- Suspending a user revokes all their sessions.
- Password reset tokens are signed JWTs bound to a hash of the current password hash, so a reset link stops working after a successful reset.

### Password reset without email

No email provider is configured in Phase 1. `POST /v1/auth/forgot-password` always returns a generic success response. In development the reset link is written to the API log; the user-facing page explains that delivery requires a configured email provider. See [Known limitations](PHASE-1-REPORT.md#known-limitations).

---

## 4. API architecture

### Bootstrap

- Global prefix `v1`
- Helmet security headers, cookie parser, CORS restricted to `CORS_ORIGINS`
- Global `ValidationPipe` (`whitelist`, `transform`)
- Global `HttpExceptionFilter` producing a consistent error envelope
- Swagger at `/api/docs`
- Graceful shutdown hooks

### Global guards

| Guard | Behaviour |
| --- | --- |
| `ThrottlerGuard` | 180 requests/minute per IP; auth routes 12/minute. Requests carrying the configured `x-internal-key` from the website's SSR layer are excluded. |
| `JwtAuthGuard` | Requires a valid bearer token unless the route is marked `@Public()` |
| `RolesGuard` | Enforces `@Roles(...)` / permission requirements |

### Modules

| Module | Base path | Responsibility |
| --- | --- | --- |
| `health` | `/v1/health` | Liveness and database probe |
| `auth` | `/v1/auth` | Register, login, refresh, logout, me, password reset |
| `tenders` | `/v1/tenders` | Public published tender list, detail, similar |
| `catalog` | `/v1` | Categories, provinces, departments, sources, public settings |
| `stats` | `/v1/stats` | Live counts computed from the database |
| `plans` | `/v1/plans` | Public subscription plans |
| `me` | `/v1/me` | Profile, preferences, saved tenders, saved searches, alerts, notifications, subscription, invoices, account deletion |
| `admin` | `/v1/admin` | Overview, users, settings, integrations, audit logs, health, tender CRUD and workflow |
| `collection` | `/v1/admin/collection` | Source registry, runs, imports, review, duplicates, manual upload, queue and dead-letter operations |

### Collection pipeline

```
scheduler tick (BullMQ, every minute)
  -> claim due sources (conditional nextRunAt)
  -> collect-source job -> Redis per-source lock
       -> connector fetches listing (rate-limited, SSRF-guarded)
       -> documents downloaded + stored (SHA-256, OCR/text)
       -> field extraction + normalization + optional AI
       -> duplicate detection (exact auto-merge, fuzzy to review)
       -> TenderImport + Tender (PENDING_VERIFICATION)
  -> failed after 3 attempts -> collection-dlq -> admin retry
```

Each source is independent: its connector, schedule, rate limit, page budget,
auto-publish flag and confidence threshold live on `TenderSource`. Detailed
behaviour is documented in [COLLECTION.md](COLLECTION.md).

### Error envelope

The exception filter returns a stable shape:

```json
{
  "statusCode": 400,
  "message": "Human readable message",
  "error": "Bad Request",
  "requestId": "0f8c...",
  "path": "/v1/...",
  "timestamp": "2026-11-14T08:00:00.000Z"
}
```

Validation failures are collapsed to the first readable Zod/class-validator message by the shared helpers.

### Public versus private data

- Public tender lists return `PUBLISHED` records with `deletedAt = null`.
- Detail pages also allow `CLOSED`.
- Admin endpoints include drafts, pending and archived records.
- `GET /v1/settings/public` returns only settings with `isPublic = true`.
- Integration credentials (`configJson`) are never serialised. The admin API returns only `hasConfiguration`.

---

## 5. Web architecture

### Rendering

- The App Router uses React Server Components for data fetching.
- `apiFetch` calls the public API; `apiFetchSafe` returns a fallback on failure so a public page degrades instead of throwing; `apiFetchAuthed` forwards the access cookie.
- Pages that must reflect live data (dashboard, admin, tender lists) are `force-dynamic`.
- Client components are limited to interactive widgets: filter form, save button, auth forms, admin forms, print button, action forms.

### Route handlers

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create account, set cookies |
| `POST /api/auth/login` | Sign in, set cookies |
| `POST /api/auth/logout` | Revoke session, clear cookies |
| `POST /api/auth/refresh` | Rotate tokens and rewrite cookies |
| `POST /api/auth/forgot-password` | Request a reset link |
| `POST /api/auth/reset-password` | Consume a reset token |

### Public routes

| Route | Content |
| --- | --- |
| `/` | Hero, live stats, latest tenders, closing soon, categories, how it works |
| `/tenders` | Search, filters (keyword, category, province, city, department, type, closing window, sort), pagination |
| `/tenders/[slug]` | Tender detail, documents, contact, related tenders, print, save |
| `/categories`, `/categories/[slug]` | Sector browse and filtered listings |
| `/locations`, `/locations/[slug]` | Province browse, cities, filtered listings |
| `/departments`, `/departments/[slug]` | Department directory and filtered listings |
| `/pricing` | Plans from the database, PKR pricing, feature comparison |
| `/about`, `/contact` | Static content with live support details |
| `/privacy`, `/terms`, `/disclaimer` | Legal pages |
| `/sitemap.xml`, `/robots.txt` | Generated from live catalog data with API-failure fallbacks |

### Auth routes

`/login`, `/register`, `/forgot-password`, `/reset-password` under the `(auth)` group. Login honours a safe relative `next` parameter only.

### Dashboard routes

`/dashboard` (overview), `/saved`, `/searches`, `/alerts`, `/notifications`, `/profile`, `/subscription`. Each page reads from `/v1/me/*` and uses server actions for mutations.

### Admin routes

`/admin` (overview), `/admin/tenders`, `/admin/tenders/new`, `/admin/tenders/[id]`, `/admin/users`, `/admin/settings`, `/admin/integrations`, `/admin/audit`, `/admin/health`, and the `/admin/collection/*` screens (overview, sources, runs, review, duplicates, manual import, queue).

The admin layout requires a signed-in user with an operational staff role. The API enforces the finer-grained permissions (`tender.publish`, `system.settings`, `audit.read`, and so on).

### Server actions

`apps/web/src/lib/actions.ts` contains all mutations. Each action:

1. Reads and validates `FormData`.
2. Calls the API with the access cookie.
3. Converts admin `datetime-local` values from PKT to an ISO instant with `+05:00`.
4. Returns a typed `{ ok, message }` result for the client form.
5. Calls `revalidatePath` for affected pages.

---

## 6. Data model

The Prisma schema contains 70 models and 31 enums. They group into these domains:

| Domain | Models |
| --- | --- |
| Identity and access | `User`, `UserProfile`, `UserPreference`, `Company`, `CompanyMember`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Session` |
| Geography and catalog | `Province`, `City`, `Department`, `ProcurementAuthority`, `Newspaper`, `Category` |
| Tenders | `Tender`, `TenderDocument`, `TenderDocumentDownload`, `TenderUpdate`, `TenderStatusHistory`, `TenderVerification`, `SavedTender`, `SavedSearch`, `AlertRule` |
| Collection | `TenderSource`, `SourceRun`, `SourceDocument`, `TenderImport`, `TenderDuplicateReview` |
| Notifications | `Notification`, `NotificationPreference`, `NotificationDeliveryLog`, `Reminder` |
| Billing | `SubscriptionPlan`, `Subscription`, `Payment`, `Invoice`, `Refund`, `Coupon`, `CouponRedemption` |
| AI and chatbot | `ChatbotConversation`, `ChatbotMessage`, `ChatbotFeedback`, `ChatbotKnowledgeArticle`, `ChatbotKnowledgeDocument`, `ChatbotUsageLog`, `AiProviderConfig`, `AiUsageLimit` |
| Content and SEO | `BlogCategory`, `BlogTag`, `BlogPost`, `BlogPostTag`, `Page`, `Advertisement`, `Testimonial`, `SeoMetadata`, `Redirect` |
| Support | `SupportTicket` |
| Platform operations | `Device`, `PushToken`, `AppConfiguration`, `AppAnnouncement`, `AuditLog`, `SystemSetting`, `Integration`, `ImportJob`, `ProcessingJob`, `ErrorLog` |

### Tender lifecycle

```
DRAFT -> PENDING_VERIFICATION -> PUBLISHED -> CLOSED
                              \-> CANCELLED
PUBLISHED/CLOSED -> ARCHIVED
```

- `Tender.status` tracks the publishing lifecycle.
- `Tender.verificationStatus` tracks source verification (`UNVERIFIED`, `PENDING`, `VERIFIED`, `DEMO`).
- `Tender.isDemo` marks sample records. Demo records are always excluded from being presented as real notices and can be deleted in bulk.
- Soft deletion uses `deletedAt`; public queries exclude deleted rows.
- Every status and verification change is written to history/audit tables by the admin service.

### Reference data seeded

- 7 provinces and 38 cities
- 23 categories
- 33 federal, provincial, NGO and private departments
- 5 procurement authorities, 5 newspapers, 11 tender sources
- 5 subscription plans (Free, Basic, Professional, Business, Enterprise)
- 13 roles (12 staff roles plus the standard user role) and 27 permissions
- 15 public/private settings
- 10 integration records
- 6 chatbot knowledge articles
- 3 blog categories and 3 editorial articles
- 14 clearly flagged demo tenders (optional, removable)

---

## 7. Settings and integrations

Two separate mechanisms are used deliberately:

- `SystemSetting` stores runtime-editable configuration (site name, support email, feature flags, SEO defaults, chatbot welcome text). Public rows are served by `GET /v1/settings/public`; private rows stay behind `system.settings`.
- `Integration` stores the status of external providers. Credentials live only in environment variables and are never stored in the database or returned by the API.

When a credential is absent:

- the integration row stays `NOT_CONFIGURED`
- dependent UI is disabled or labelled
- core browsing, accounts, dashboard and admin continue to work
- the health page reports the provider as not configured

---

## 8. Time, currency and locale

- Database timestamps are UTC (`DateTime`).
- The API returns ISO-8601 UTC strings.
- `@paktenders/shared-utils` renders dates with `Asia/Karachi`.
- Admin datetime inputs are interpreted as PKT and normalised to `+05:00` before sending.
- Prices are integer PKR (`pricePkr`, `amountPkr`) and formatted with `formatPkr`.
- Content is English-first with `lang="en-PK"` and an Urdu-ready locale structure.

---

## 9. Degradation strategy

| Failure | Behaviour |
| --- | --- |
| API unreachable on a public page | `apiFetchSafe` fallbacks; page still renders with empty states |
| Database down | API `/v1/health` returns `degraded`; public pages show fallbacks; admin health page reports unreachable |
| No email provider | Password reset link logged in development; UI explains delivery is unavailable |
| No AI provider | Chatbot disabled; help content still available |
| No payment gateway | Plans are visible; subscription page explains manual activation |
| No S3 | Documents are listed by metadata/URL only; uploads disabled |
| No Redis | Scheduled collection is off; admin **Run now** executes synchronously; queue screens report not ready |
| No OCR | Documents are stored and text PDFs still extract; scanned files stay `UNSUPPORTED` |
| No AI provider | Collection uses deterministic rules only; AI-labelled fields are absent |

---

## 10. SEO and accessibility

- Per-page metadata, canonicals and Open Graph tags.
- Organization JSON-LD in the root layout; tender pages expose structured data where available.
- `sitemap.ts` enumerates tenders, categories, locations and departments from the API with fallbacks.
- `robots.ts` disallows dashboard, admin and auth routes.
- Semantic headings, labelled form controls, skip link, visible focus states, keyboard-usable navigation.
- No thin auto-generated pages: category, location and department pages render only real catalog entries and real tender results.

---

## 11. Conventions

- TypeScript strict mode across workspaces.
- Shared contracts live in `packages/shared-types`; do not duplicate DTO shapes in apps.
- Validation schemas live in `packages/validation` and are reused by API and forms.
- UI primitives live in `apps/web/src/components/ui`; feature components are grouped by domain.
- Tailwind 4 theme tokens are defined in `globals.css`. Custom component classes duplicate base utilities rather than using `@apply` on other custom classes.
- Mutations go through server actions; read paths go through server components.
- Never log secrets, tokens, passwords or full integration configuration.
