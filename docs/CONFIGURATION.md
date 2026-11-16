# Configuration

Pak Tenders separates configuration into two layers:

1. **Environment variables** - deployment secrets and infrastructure endpoints. They live in the root `.env` (or the platform's secret manager) and are never stored in the database.
2. **Runtime settings** - admin-editable values stored in `system_settings` and served through `GET /v1/settings/public` when public.

Integration records in the database describe provider status only. They never contain credentials.

---

## 1. Environment file

```bash
cp .env.example .env
```

Rules:

- One root `.env` is used by both apps and by Prisma scripts.
- Never commit `.env`; it is already ignored.
- Existing process environment variables win over file values.
- The API validates a subset of variables at boot with Zod and fails fast with a readable message.

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 2. Required variables

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/paktenders?schema=public` | PostgreSQL connection used by Prisma |
| `JWT_ACCESS_SECRET` | 48-byte random string | Signs 15-minute access tokens; minimum 32 characters |
| `JWT_REFRESH_SECRET` | different 48-byte random string | Signs refresh tokens; minimum 32 characters |

The API refuses to boot if any of these are missing or too short.

---

## 3. Runtime and API

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `API_PORT` | `4000` | API listen port |
| `API_PUBLIC_URL` | `http://localhost:4000` | Public API origin used in logs and docs |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated browser origins allowed to call the API |
| `INTERNAL_API_KEY` | empty | Shared secret sent by the website on server-side API calls so SSR traffic is not counted against the public per-IP limit |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime (parsed to seconds) |
| `JWT_REFRESH_TTL_DAYS` | `30` | Refresh token lifetime in days |

In production set `CORS_ORIGINS` to the exact site origins, for example `https://paktenders.pk,https://www.paktenders.pk`. Do not use `*` with credentials.

---

## 4. Web

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Browser-facing site origin; also controls cookie `Secure` behaviour |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser-facing API origin |
| `API_INTERNAL_URL` | `http://localhost:4000` | Server-side API origin used by RSC and route handlers |
| `SITE_URL` | `http://localhost:3000` | Canonical origin used in password-reset links |

`NEXT_PUBLIC_*` values are inlined at build time. Rebuild the web app after changing them.

Cookie security rule: cookies are `Secure` whenever `NODE_ENV=production`, unless `NEXT_PUBLIC_SITE_URL` is explicitly an `http://localhost` or `http://127.0.0.1` origin. This allows local production smoke tests over HTTP without weakening a real deployment.

---

## 5. Optional integrations

Every variable in this section may stay empty. The platform stays usable and the matching admin integration stays `NOT_CONFIGURED`.

### Redis and queues

| Variable | Default | Effect when empty |
| --- | --- | --- |
| `REDIS_URL` | empty | No queue connection; scheduled collection is off; admin **Run now** runs synchronously |
| `BULLMQ_PREFIX` | `paktenders` | Queue key prefix (`paktenders:collection:*`) |

Redis powers the tender collection scheduler. Without it the platform still
runs: collection sources can be triggered manually and run in-process, but no
background jobs are queued.

### Tender collection

| Variable | Default | Purpose |
| --- | --- | --- |
| `COLLECTION_ENABLED` | `true` | Master switch for the collection queue and worker |
| `COLLECTION_WORKER_ENABLED` | `true` | Start the BullMQ worker in this process |
| `COLLECTION_CONCURRENCY` | `2` | Worker concurrency (local build uses `4`) |
| `COLLECTION_USER_AGENT` | `PakTendersBot/1.0 (+https://paktenders.pk/bot)` | Outbound User-Agent |
| `COLLECTION_HTTP_TIMEOUT_MS` | `30000` | Fetch timeout in milliseconds |
| `COLLECTION_MAX_DOCUMENT_MB` | `25` | Maximum document size |
| `COLLECTION_MAX_ITEMS_PER_RUN` | `100` | Items processed per run |
| `COLLECTION_DEADLINE_CRON` | `0 2 * * *` | Daily deadline reconciliation (Asia/Karachi) |
| `COLLECTION_RECONCILE_CRON` | `30 2 * * *` | Daily full source reconciliation (Asia/Karachi) |
| `OCR_ENABLED` | `true` | Enable Tesseract OCR for scanned PDFs and images |
| `OCR_LANGUAGES` | `eng,urd` | OCR languages |
| `AI_COLLECTION_ENABLED` | `true` | Allow AI enrichment when an AI provider is configured |

### Collection email feed

The IMAP connector reads a mailbox that an administrator explicitly configures.
Credentials stay in the environment, never in the database.

| Variable | Purpose |
| --- | --- |
| `COLLECTION_EMAIL_HOST` | IMAP host |
| `COLLECTION_EMAIL_USER` | IMAP user |
| `COLLECTION_EMAIL_PASSWORD` | IMAP password |

Port, TLS, mailbox, lookback window and subject filter are set in the source's
`configJson` (`port`, `secure`, `mailbox`, `sinceDays`, `subjectPattern`). A
source may also point `passwordEnv` at a different environment variable name.
When credentials are absent the connector fails with `MISSING_CREDENTIAL` and the
source stays disabled.

### Transactional email

| Variable | Purpose |
| --- | --- |
| `EMAIL_PROVIDER` | `resend`, `ses` or `smtp` |
| `EMAIL_FROM` | Sender address |
| `RESEND_API_KEY` | Resend API key |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP credentials |

Without a provider:

- password reset links are written to the API log in development only
- email alerts and verification emails are not delivered
- the UI states that email delivery is unavailable
- users are created `ACTIVE` with `emailVerifiedAt = null`

### Object storage

| Variable | Purpose |
| --- | --- |
| `S3_ENDPOINT` | S3-compatible endpoint |
| `S3_REGION` | Region |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials |
| `S3_PUBLIC_BASE_URL` | Public asset base URL |

Without storage, tender documents are referenced by metadata and external URL only. No upload endpoint is exposed.

### AI and chatbot

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `openai`, `anthropic`, `google`, `openrouter` or `local` |
| `AI_MODEL` | Model identifier |
| `AI_API_KEY` | Provider key |
| `AI_BASE_URL` | Optional custom endpoint |
| `CHATBOT_ENABLED` | `true` only after a provider is configured |

Without a provider the chatbot stays disabled, the help/knowledge content remains available and no fake answers are produced.

### Payments

| Variable | Provider |
| --- | --- |
| `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT` | JazzCash |
| `EASYPAISA_STORE_ID`, `EASYPAISA_HASH_KEY` | Easypaisa |
| `CARD_GATEWAY_KEY`, `CARD_GATEWAY_SECRET` | Card gateway |

Without credentials, plans remain visible, checkout is disabled and the subscription page explains manual activation. Raw card data is never stored.

### Push notifications

| Variable | Purpose |
| --- | --- |
| `EXPO_ACCESS_TOKEN` | Expo push access token |
| `FCM_SERVER_KEY` | Android push |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` | iOS push |

Without credentials, in-app notifications work and external delivery is disabled.

### Analytics and verification

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GA4_ID` | GA4 measurement ID |
| `NEXT_PUBLIC_GTM_ID` | Tag Manager container |
| `GOOGLE_SITE_VERIFICATION` | Search Console verification token |
| `BING_SITE_VERIFICATION` | Bing verification token |

Analytics scripts are not injected unless configured.

---

## 6. Seed and bootstrap

| Variable | Default | Purpose |
| --- | --- | --- |
| `SEED_ADMIN_EMAIL` | `admin@paktenders.pk` | Super Admin email |
| `SEED_ADMIN_PASSWORD` | `ChangeMe!PakTenders2026` | Super Admin password; change before production |
| `SEED_DEMO_DATA` | `true` | Create 14 flagged demo tenders |

Demo tenders are always `isDemo = true`, `verificationStatus = DEMO` and titled `[Demo]`. Remove them with `pnpm db:purge-demo`.

---

## 7. Runtime settings

Admins edit these in `/admin/settings`. Values are JSON; strings must be quoted. Every change is audited.

| Key | Public | Current effect |
| --- | --- | --- |
| `site.name` | Yes | Site name in the header, footer and metadata |
| `site.tagline` | Yes | Brand tagline |
| `site.supportEmail` | Yes | Support address in the footer, contact and legal pages |
| `site.supportPhone` | Yes | Support phone number |
| `site.announcement` | Yes | Announcement bar text; `null` hides the bar |
| `site.maintenanceMode` | Yes | Stored for operations; not yet enforced by middleware |
| `features.registration` | Yes | When `false`, the register page is replaced with a closed-registration notice |
| `features.tenderPublishing` | Yes | Stored feature flag; reserved for future use |
| `features.subscriptions` | Yes | Stored feature flag; reserved for future use |
| `features.emailAlerts` | Yes | Reflects whether an email provider is available |
| `features.pushNotifications` | Yes | Reflects whether push is available |
| `chatbot.enabled` | Yes | Public chatbot availability flag |
| `chatbot.welcomeMessage` | Yes | Greeting shown by the future chatbot |
| `seo.defaultTitle` | Yes | Default metadata title |
| `seo.defaultDescription` | Yes | Default metadata description |

Settings store no secrets. Provider credentials belong in environment variables only.

---

## 8. Integration status

The seed creates 10 integration records:

| Key | Category | Required configuration |
| --- | --- | --- |
| `email` | EMAIL | `EMAIL_PROVIDER` + provider credentials |
| `payments.jazzcash` | PAYMENTS | JazzCash credentials |
| `payments.easypaisa` | PAYMENTS | Easypaisa credentials |
| `payments.card` | PAYMENTS | Card gateway credentials |
| `ai.provider` | AI | `AI_PROVIDER` + `AI_API_KEY` |
| `push.expo` | PUSH | `EXPO_ACCESS_TOKEN` |
| `storage.s3` | STORAGE | S3 credentials |
| `analytics.ga4` | ANALYTICS | `NEXT_PUBLIC_GA4_ID` |
| `messaging.whatsapp` | MESSAGING | WhatsApp Business API credentials |
| `messaging.sms` | MESSAGING | SMS gateway credentials |

Status values are shown in `/admin/integrations` and `/admin/health`. Credentials are never returned; the API exposes only `hasConfiguration`.

---

## 9. Security rules

- Use different secrets for access and refresh tokens.
- Rotate JWT secrets by invalidating sessions; all users will need to sign in again.
- Keep `CORS_ORIGINS` narrow in production.
- Serve the site and API over HTTPS.
- Restrict database access by network and use TLS in production.
- Store production secrets in the platform secret manager, not in the repository.
- Do not place provider keys in `system_settings`.
- Review the audit log after administrative changes.
- Change the seeded Super Admin password before exposing the site.

---

## 10. Production example

```dotenv
NODE_ENV=production

DATABASE_URL="postgresql://paktenders:<strong-password>@db.internal:5432/paktenders?schema=public&sslmode=require"

API_PORT=4000
API_PUBLIC_URL="https://api.paktenders.pk"
CORS_ORIGINS="https://paktenders.pk,https://www.paktenders.pk"
JWT_ACCESS_SECRET="<48-byte secret>"
JWT_REFRESH_SECRET="<different 48-byte secret>"
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
REDIS_URL="redis://127.0.0.1:6379"
BULLMQ_PREFIX="paktenders"
COLLECTION_ENABLED=true
COLLECTION_WORKER_ENABLED=true
COLLECTION_CONCURRENCY=4
OCR_ENABLED=true
OCR_LANGUAGES="eng,urd"
AI_COLLECTION_ENABLED=true
```

Add `COLLECTION_EMAIL_HOST`, `COLLECTION_EMAIL_USER` and
`COLLECTION_EMAIL_PASSWORD` only when an IMAP tender feed is available.

All optional provider variables can be omitted until the corresponding integration is ready.
