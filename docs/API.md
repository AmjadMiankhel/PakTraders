# API reference

Base URL: `http://localhost:4000/v1`

Interactive documentation: `http://localhost:4000/api/docs` (Swagger UI, generated from the NestJS controllers).

All responses are JSON. Timestamps are ISO-8601 UTC; render them in `Asia/Karachi`. Monetary values are integers in PKR unless the field name says otherwise.

---

## 1. Conventions

### Authentication

Protected endpoints expect a bearer token:

```http
Authorization: Bearer <accessToken>
```

Access tokens live for 15 minutes. Refresh with `POST /v1/auth/refresh` and the refresh token. The website stores both tokens in httpOnly cookies; mobile clients should use the authorization header.

### Rate limits

| Scope | Limit |
| --- | --- |
| Default | 180 requests per minute per IP |
| Auth routes | 12 requests per minute per IP (register 6, login 10, password reset 5) |
| Website SSR | Excluded from public throttling when `INTERNAL_API_KEY` is configured |

Exceeding a limit returns `429 Too Many Requests`. The API trusts one proxy hop so per-IP limits use the real client address behind Nginx.

### Pagination

List endpoints return:

```json
{
  "items": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 1 }
}
```

`page` starts at 1. `pageSize` is capped at 100.

### Errors

```json
{
  "statusCode": 400,
  "message": "title: Title is too short",
  "error": "Bad Request",
  "requestId": "6c0f...",
  "path": "/v1/admin/tenders",
  "timestamp": "2026-11-14T08:00:00.000Z"
}
```

`requestId` is useful when correlating with server logs and the `error_logs` table.

### Public versus private

- Endpoints marked **Public** require no token.
- Everything under `/v1/me` and `/v1/admin` requires authentication.
- Admin endpoints additionally require a staff role and, in most cases, a named permission.
- Public tender listings only return `PUBLISHED` records. Public detail pages allow `PUBLISHED` and `CLOSED`.

---

## 2. Health and stats

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/v1/health` | Public | Liveness plus database connectivity |
| GET | `/v1/stats` | Public | Live platform counts |
| GET | `/v1/plans` | Public | Active subscription plans |

`GET /v1/health`

```json
{
  "status": "ok",
  "database": "connected",
  "uptimeSeconds": 3120,
  "timestamp": "2026-11-14T08:00:00.000Z"
}
```

`GET /v1/stats`

```json
{
  "publishedTenders": 14,
  "activeTenders": 12,
  "closingSoon": 3,
  "categories": 23,
  "departments": 33,
  "sources": 9,
  "demoRecords": 14,
  "generatedAt": "2026-11-14T08:00:00.000Z"
}
```

`demoRecords` is the number of seeded sample tenders. It must reach zero before launch.

---

## 3. Auth

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/v1/auth/register` | Public | Create an account |
| POST | `/v1/auth/login` | Public | Sign in |
| POST | `/v1/auth/refresh` | Public | Rotate a refresh token |
| POST | `/v1/auth/logout` | Public | Revoke one refresh token |
| POST | `/v1/auth/forgot-password` | Public | Request a reset link |
| POST | `/v1/auth/reset-password` | Public | Set a new password |
| GET | `/v1/auth/me` | Bearer | Current user |
| POST | `/v1/auth/logout-all` | Bearer | Revoke every session |

### Register

```http
POST /v1/auth/register
Content-Type: application/json

{
  "fullName": "Ayesha Khan",
  "email": "ayesha@example.com",
  "password": "StrongPass123",
  "phone": "03001234567",
  "acceptTerms": true
}
```

Password rules: at least 10 characters, one lowercase, one uppercase and one digit. Phone is optional and must be a Pakistani mobile number.

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "ayesha@example.com",
    "fullName": "Ayesha Khan",
    "roles": ["USER"],
    "permissions": [],
    "status": "ACTIVE",
    "emailVerified": false
  },
  "tokens": {
    "accessToken": "…",
    "refreshToken": "…",
    "expiresIn": 900
  }
}
```

Email verification is not enforced in Phase 1 because no email provider is configured.

### Login

```http
POST /v1/auth/login
Content-Type: application/json

{ "email": "admin@paktenders.pk", "password": "ChangeMe!PakTenders2026" }
```

Returns the same `{ user, tokens }` envelope. Invalid credentials return `401` with a generic message.

### Refresh

```http
POST /v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "…" }
```

Returns a new token pair and revokes the previous session record. Reusing a revoked token fails.

### Password reset

`POST /v1/auth/forgot-password` always returns `{ "success": true }` so account existence is not leaked. Without an email provider the link is only written to the API log in development.

```http
POST /v1/auth/reset-password
Content-Type: application/json

{ "token": "<token from the reset link>", "password": "NewStrongPass123" }
```

A reset token stops working after a successful reset or password change.

---

## 4. Tenders (public)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/v1/tenders` | Public | Search published tenders |
| GET | `/v1/tenders/:slug` | Public | Tender detail by slug |
| GET | `/v1/tenders/:slug/similar` | Public | Related tenders |

### Search parameters

| Parameter | Type | Notes |
| --- | --- | --- |
| `q` | string | Keyword across title, description and reference number |
| `category` | string | Category slug |
| `province` | string | Province slug |
| `city` | string | City slug |
| `department` | string | Department slug |
| `type` | enum | `GOVERNMENT`, `PRIVATE`, `NGO`, `AUCTION`, `CONSULTANCY`, `NEWSPAPER` |
| `closingWithinDays` | integer | 0-365 |
| `publishedFrom` | ISO date | Lower bound on publish date |
| `page` | integer | Default 1 |
| `pageSize` | integer | Default 20, max 100 |
| `sort` | enum | `newest`, `closing`, `relevance` |

Example:

```http
GET /v1/tenders?q=solar&province=punjab&closingWithinDays=30&sort=closing&page=1&pageSize=12
```

```json
{
  "items": [
    {
      "id": "uuid",
      "slug": "demo-solar",
      "title": "[Demo] Solarisation of a public school",
      "summary": "…",
      "referenceNumber": "…",
      "tenderType": "GOVERNMENT",
      "status": "PUBLISHED",
      "verificationStatus": "DEMO",
      "isDemo": true,
      "isFeatured": false,
      "publishedAt": "2026-11-10T…",
      "closingAt": "2026-12-01T…",
      "estimatedValue": "2500000",
      "category": { "name": "Solar and Renewable Energy", "slug": "solar-renewable-energy" },
      "province": { "name": "Punjab", "slug": "punjab" },
      "city": { "name": "Lahore", "slug": "lahore" },
      "department": { "name": "Punjab Public Works Department", "slug": "punjab-pwd" }
    }
  ],
  "meta": { "page": 1, "pageSize": 12, "total": 1, "totalPages": 1 }
}
```

Detail includes description, eligibility, documents, contact details, source attribution, required documents and `isSaved` when a bearer token is supplied.

`GET /v1/tenders/:slug/similar?limit=4` returns up to 12 published tenders in the same category or province.

---

## 5. Catalog

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/v1/categories` | Public | Active categories with published counts |
| GET | `/v1/categories/:slug` | Public | One category |
| GET | `/v1/locations/provinces` | Public | Provinces with cities and counts |
| GET | `/v1/departments` | Public | Departments, optional `province` slug and `limit` |
| GET | `/v1/departments/:slug` | Public | One department |
| GET | `/v1/sources` | Public | Tender sources and attribution |
| GET | `/v1/settings/public` | Public | Public runtime settings |

`GET /v1/settings/public` returns a flat object:

```json
{
  "site.name": "Pak Tenders",
  "site.tagline": "Discover. Analyze. Track. Win.",
  "site.supportEmail": "support@paktenders.pk",
  "site.supportPhone": "+92 300 0000000",
  "site.announcement": null,
  "features.registration": true,
  "seo.defaultTitle": "…"
}
```

Only rows with `isPublic = true` are included. Secrets are never stored in settings.

---

## 6. Account (`/v1/me`)

All endpoints require a bearer token and act only on the current user.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/me/profile` | Profile, preferences and active subscription |
| PATCH | `/v1/me/profile` | Update name, phone, job title, bio, location, keywords, marketing opt-in |
| PATCH | `/v1/me/preferences` | Theme, language, notification channels, digest, quiet hours |
| GET | `/v1/me/saved-tenders` | Paginated saved tenders |
| POST | `/v1/me/saved-tenders/:tenderId` | Save a tender |
| DELETE | `/v1/me/saved-tenders/:tenderId` | Remove a saved tender |
| GET | `/v1/me/saved-searches` | Saved searches |
| POST | `/v1/me/saved-searches` | Save a search (`name`, `queryJson`) |
| DELETE | `/v1/me/saved-searches/:id` | Delete a saved search |
| GET | `/v1/me/alerts` | Alert rules |
| POST | `/v1/me/alerts` | Create an alert rule |
| PATCH | `/v1/me/alerts/:id` | Enable or disable an alert |
| DELETE | `/v1/me/alerts/:id` | Delete an alert |
| GET | `/v1/me/notifications` | In-app notifications and unread count |
| PATCH | `/v1/me/notifications/read` | Mark all or selected notifications read |
| GET | `/v1/me/subscription` | Current subscription (empty body when none) |
| GET | `/v1/me/invoices` | Invoice history |
| DELETE | `/v1/me/account` | Delete the account (confirmation must be `DELETE`) |

### Alert rule body

```json
{
  "name": "Solar tenders in Punjab",
  "queryJson": { "q": "solar", "province": "punjab" },
  "categoryId": null,
  "frequency": "DAILY",
  "channels": ["IN_APP", "EMAIL"],
  "isActive": true
}
```

`channels` accepts `IN_APP`, `EMAIL`, `PUSH`, `WHATSAPP`, `SMS`. In Phase 1 only in-app records are produced; external channels wait for provider configuration.

### Account deletion

```http
DELETE /v1/me/account
Authorization: Bearer <token>
Content-Type: application/json

{ "confirmation": "DELETE" }
```

Deletion revokes sessions, removes saved tenders, deactivates alerts and push tokens, and anonymises direct identifiers. Invoices and audit records retain the account id for accounting and legal purposes.

---

## 7. Admin (`/v1/admin`)

Every endpoint requires a bearer token and a staff role. Named permissions are enforced by the API.

### Overview and operations

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/v1/admin/overview` | `audit.read` | Tender, user, finance, notification and audit summary |
| GET | `/v1/admin/users?q=&status=&page=&pageSize=` | `user.read` | Search users |
| PATCH | `/v1/admin/users/:id/status` | `user.suspend` | Set `ACTIVE` or `SUSPENDED` |
| GET | `/v1/admin/settings` | `system.settings` | All settings |
| PATCH | `/v1/admin/settings` | `system.settings` | Update one setting (audited) |
| GET | `/v1/admin/integrations` | `integration.manage` | Provider status, no credentials |
| GET | `/v1/admin/audit-logs?page=&pageSize=` | `audit.read` | Immutable admin action log |
| GET | `/v1/admin/health` | `system.health` | API, database, Redis, email, AI, storage, push and payment status |

Suspending a user revokes all their sessions. An admin cannot change their own status.

### Tender management

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/v1/admin/tenders` | `tender.read` | List tenders of every status |
| POST | `/v1/admin/tenders` | `tender.create` | Create a tender |
| GET | `/v1/admin/tenders/:id` | `tender.read` | Tender by id, any status |
| PATCH | `/v1/admin/tenders/:id` | `tender.update` | Update fields |
| POST | `/v1/admin/tenders/:id/status` | `tender.publish` | Change lifecycle status |
| POST | `/v1/admin/tenders/:id/verify` | `tender.verify` | Change verification status |
| DELETE | `/v1/admin/tenders/:id` | `tender.delete` | Soft delete |

Admin list filters extend the public search with `status`, `verificationStatus` and `includeDeleted`.

### Status change

```http
POST /v1/admin/tenders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "PUBLISHED", "reason": "Verified against source notice" }
```

Allowed values: `DRAFT`, `PENDING_VERIFICATION`, `PUBLISHED`, `CLOSED`, `CANCELLED`, `ARCHIVED`.

### Verification change

```http
POST /v1/admin/tenders/:id/verify
Content-Type: application/json

{ "status": "VERIFIED", "notes": "Checked against PPRA notice" }
```

Allowed values: `UNVERIFIED`, `PENDING`, `VERIFIED`. Demo records use `DEMO` at creation time and are not promoted through this endpoint.

### Create tender body (summary)

```json
{
  "title": "Supply of medical equipment",
  "description": "At least 30 characters describing the requirement…",
  "categoryId": "uuid",
  "departmentId": "uuid",
  "provinceId": "uuid",
  "cityId": "uuid",
  "tenderType": "GOVERNMENT",
  "status": "DRAFT",
  "closingAt": "2026-12-15T10:00:00+05:00",
  "estimatedValue": 5000000,
  "bidSecurityAmount": 100000,
  "requiredDocuments": ["Registration certificate", "Tax clearance"],
  "contactEmail": "procurement@example.gov.pk",
  "originalUrl": "https://example.gov.pk/tender/123",
  "sourceAttribution": "Published in a national newspaper on 2026-11-10"
}
```

`status`, `verificationStatus`, `publishedAt`, `closingAt` and `openingAt` are optional. Admin datetime inputs from the website are sent with `+05:00`; the API stores UTC.

### Collection (`/v1/admin/collection`)

All routes require a staff bearer token. Reads use `tender.read`; writes use
`tender.import`; publishing and merging additionally require `tender.publish`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/overview` | Totals, queue state and schedules |
| GET | `/sources?enabled=&status=&category=&q=&page=&pageSize=` | List sources |
| GET | `/sources/:id` | Source config, counters and recent runs |
| PATCH | `/sources/:id` | Enable, pause or reconfigure |
| POST | `/sources/:id/run` | Run now (`{ "force": true }` bypasses the schedule) |
| GET | `/runs?sourceId=&status=&trigger=&page=&pageSize=` | Run history |
| GET | `/runs/:id` | Run detail, imports, documents and notes |
| GET | `/imports?status=&sourceId=&q=&page=&pageSize=` | Review queue |
| GET | `/imports/:id` | Raw payload, extracted fields, provenance and reviews |
| POST | `/imports/:id/review` | `{ "action": "PUBLISH" \| "REJECT" \| "NEEDS_REVIEW", "notes"?, "edits"? }` |
| POST | `/imports/manual` | Import a notice from a manual source |
| POST | `/imports/upload` | Multipart PDF/image upload (`file` + fields) |
| GET | `/duplicates?decision=&page=&pageSize=` | Possible duplicates |
| POST | `/duplicates/:id/resolve` | `{ "decision": "MERGE" \| "KEEP_SEPARATE" \| "IGNORE", "notes"? }` |
| GET | `/jobs` | Queue counters and dead-letter entries |
| POST | `/jobs/dead-letters/:id/retry` | Re-queue the failed source |
| GET | `/documents/:id/file` | Download a stored original |

A source can only be enabled when its connector exists in this build and the
source is marked `isVerified`. A manual import must include a source URL or an
uploaded document, and datetimes must be ISO-8601 with an offset:

```http
POST /v1/admin/collection/imports/manual
Content-Type: application/json

{
  "sourceId": "uuid",
  "title": "Supply of office stationery",
  "organization": "Public Works Department",
  "province": "Gilgit-Baltistan",
  "publishedAt": "2026-12-01T10:00:00+05:00",
  "closingAt": "2026-12-20T15:00:00+05:00",
  "sourceUrl": "https://example.gov.pk/notices/123"
}
```

The response reports the ingest outcome (`NEW`, `NEEDS_REVIEW`, `DUPLICATE`,
`UPDATED`, …), the tender id, duplicate details and the confidence. Admin
uploads are stored privately (`isPublic = false`) and never appear on the public
tender page.

---

## 8. Response field conventions

| Field | Meaning |
| --- | --- |
| `status` | Tender lifecycle: `DRAFT`, `PENDING_VERIFICATION`, `PUBLISHED`, `CLOSED`, `CANCELLED`, `ARCHIVED` |
| `verificationStatus` | `UNVERIFIED`, `PENDING`, `VERIFIED`, `DEMO` |
| `isDemo` | Sample record; must be removed before launch |
| `deletedAt` | Soft deletion timestamp; public queries exclude it |
| `*At` | ISO-8601 UTC timestamp |
| `*Pkr` | Integer amount in Pakistani Rupees |
| `isSaved` | Whether the current bearer user saved the tender |

---

## 9. Client examples

```bash
# health
curl http://localhost:4000/v1/health

# login
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@paktenders.pk\",\"password\":\"ChangeMe!PakTenders2026\"}"

# authenticated request
curl http://localhost:4000/v1/me/profile \
  -H "Authorization: Bearer <accessToken>"

# admin tender list
curl "http://localhost:4000/v1/admin/tenders?status=PENDING_VERIFICATION" \
  -H "Authorization: Bearer <accessToken>"
```

Use Swagger UI at `/api/docs` for the full generated schema, including every DTO field and enum.
