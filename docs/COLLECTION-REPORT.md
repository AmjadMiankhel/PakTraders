# Tender collection module — completion report

Date: 16 November 2026

Project: Pak Tenders (paktenders.pk)

Scope: Fully automated tender collection, updates and monitoring system (NestJS,
PostgreSQL, Redis, BullMQ).

---

## 1. Summary

The collection module is implemented and verified end to end on the local
production build. It retrieves tenders from real, reachable Pakistani sources,
downloads and stores permitted documents, extracts structured fields with
deterministic rules and optional OCR/AI, detects duplicates, and routes uncertain
records to a human review queue. Every source is independently enabled,
configured, scheduled and monitored from the Super Admin console.

Three official sources are enabled and collecting: PPRA EPMS (federal), AJK PPRA
and GB PPRA. Sources that were unreachable or restricted at setup are configured
but disabled, with the access reason recorded. Nothing is faked: a source without
a working connector cannot be enabled.

---

## 2. Completed features

### 2.1 Connectors

| Feature | Status |
| --- | --- |
| PPRA EPMS connector (listing, detail pages, PDFs) | Complete |
| Generic HTML table connector (header synonyms, detail links, pagination) | Complete |
| RSS / Atom connector | Complete |
| JSON API connector | Complete |
| CSV / dataset connector | Complete |
| Document-monitor connector | Complete |
| IMAP email-feed connector | Complete |
| Manual import connector | Complete |
| Connector registry with unknown-key rejection | Complete |
| Shared HTTP client: timeout, rate limit, robots, SSRF guard, max size | Complete |

### 2.2 Extraction

| Feature | Status |
| --- | --- |
| Reference number, organisation, department, contacts | Complete |
| Dates and times with PKT handling and end-of-day fallback | Complete |
| Eligibility, bid security, estimated value, required documents | Complete |
| Category, province and tender-type normalisation | Complete |
| Text PDF extraction (`pdf-parse`) | Complete |
| Scanned PDF and image OCR (Tesseract `eng+urd`) | Complete |
| Per-field provenance (`SOURCE` / `RULE` / `AI` / `MANUAL`) and confidence | Complete |
| Optional AI classification and summaries (provider-dependent) | Complete |
| Uncertainty warnings and review flags | Complete |

### 2.3 Duplicate detection

| Feature | Status |
| --- | --- |
| Exact source id, reference, document hash and notice URL | Complete |
| Fuzzy matching guarded by reference conflict and title/org/date agreement | Complete |
| Automatic merge for exact matches with review record | Complete |
| Human review for fuzzy matches (merge / keep separate / ignore) | Complete |
| Merge records retained (`TenderDuplicateReview`, `duplicateOfId`) | Complete |

### 2.4 Scheduling and reliability

| Feature | Status |
| --- | --- |
| BullMQ queues with `BULLMQ_PREFIX` | Complete |
| Per-source schedules editable in admin | Complete |
| Scheduler tick with conditional claim (no double runs) | Complete |
| Redis per-source lock (30 min) | Complete |
| Deterministic job ids (no duplicate queued jobs) | Complete |
| Exponential backoff (30s, 60s) with 3 attempts | Complete |
| Dead-letter queue and admin retry | Complete |
| Daily deadline reconciliation | Complete |
| Daily full source reconciliation | Complete |
| Synchronous fallback when worker disabled | Complete |

### 2.5 Admin

| Feature | Status |
| --- | --- |
| Overview, sources, source detail, runs, run detail | Complete |
| Review queue and review detail with edits | Complete |
| Duplicate review screen | Complete |
| Manual URL import and PDF/image upload | Complete |
| Queue and dead-letter screen | Complete |
| Stored-document download proxy | Complete |
| Per-source enable/pause/config with verification guard | Complete |

---

## 3. Files and modules

### API (`apps/api/src/modules/collection`)

- `collection.module.ts`, `collection.types.ts`
- `collection-processor.service.ts` — run orchestration, extraction, dedupe, merge
- `collection-queue.service.ts` — queues, worker, locks, retries, DLQ
- `collection-scheduler.service.ts` — deadline and source reconciliation
- `collection-admin.controller.ts`, `collection-admin.service.ts`
- `connectors/` — `epms`, `table`, `rss`, `json-api`, `csv`, `document`, `email`,
  `manual`, `http-client`, `connector.registry`, `connector.types`
- `extraction/` — `date-utils`, `field-extractor`, `parse-helpers`, `ocr.service`,
  `document-extractor.service`, `ai-classifier.service`
- `normalization.service.ts`, `dedupe.service.ts`

### Web (`apps/web/src`)

- `app/admin/collection/**` — overview, sources, source detail, runs, run detail,
  review, review detail, duplicates, import, jobs, document proxy route
- `components/admin/collection-*` — nav, badges, source form, review form,
  manual-import form
- `lib/collection-types.ts`, `lib/collection-utils.ts`, collection server actions

### Database

- `database/prisma/schema.prisma` — collection enums and models
- Migrations `20261114090000_collection_system`, `20261114091500_collection_counts`
- `database/prisma/seed.ts` — 11-source registry with honest access notes

### Configuration

- `packages/config/src/index.ts` — collection/Redis/OCR/AI variables
- `.env`, `.env.example`

---

## 4. Tests performed and results

All checks were manual against the local build (PostgreSQL 17.6, Redis 8.10.3,
API on `:4000`, web on `:3000`).

| Test | Result |
| --- | --- |
| API and web build / typecheck | Pass |
| `/v1/health` | `ok`, database connected |
| EPMS bulk run | 50 found, 49 review, 1 duplicate, 150 documents |
| AJK run | Distinct imports and PDF URLs, 0 false duplicates |
| GB run | 10 items, 10 review, 10 documents, HTTP 200, correct titles/refs |
| Text PDF extraction | Correct fields |
| Scanned PDF OCR | `COMPLETED`, ~0.91 confidence, 1,988 chars |
| Image OCR (English + Urdu) | ~0.94 confidence |
| Extraction fixes | Reference, org, published/closing PKT, eligibility, bid, email correct |
| Manual image upload | `201`, `NEEDS_REVIEW`, 1 document, `isPublic=false` |
| Manual URL import | Real GB notice → `NEEDS_REVIEW`, document stored, URL preserved |
| Manual duplicate | Same notice URL → `DUPLICATE` via `EXACT_URL` |
| Non-ISO datetime rejected | `400` |
| Review PUBLISH | Import `PUBLISHED`, tender `PUBLISHED`, verified |
| Review REJECT | Import `REJECTED`, tender `ARCHIVED` |
| Review KEEP | Status stays `NEEDS_REVIEW`, notes updated |
| Dead letter / retry | 3 attempts at 30s/60s, 1 DLQ entry, retry cleared it |
| Document proxy | `200`, correct byte length |
| Public exposure | Published upload shows 0 public documents |
| Fuzzy duplicate — keep | Both records kept, candidate `needsReview=false` |
| Fuzzy duplicate — merge | Candidate `ARCHIVED` + `deletedAt`, primary intact |
| Queue keys | Registered under prefix `paktenders` |
| Admin pages (authenticated SSR) | All 7 collection pages return `200` |

---

## 5. Remaining tasks

1. **Confirm the truncated requirement.** The original module message ended mid
   sentence at "Keep a record of merged". The missing remainder must be confirmed
   before treating the duplicate/merge specification as final.
2. **Re-verify KPPRA** from the deployment network and enable it if reachable.
3. **Re-verify SPPRA, BPPRA and Punjab e-procurement**; implement connectors only
   after a reachable, permitted endpoint is confirmed.
4. **Obtain licensed newspaper feeds** before enabling classified sources.
5. **Configure S3** and move document storage off the local disk.
6. **Add automated tests** for connectors, extraction, dedupe and review flows.
7. **Load-test** the worker before scaling to multiple API instances.

---

## 6. Missing credentials and access

| Integration | Missing | Effect |
| --- | --- | --- |
| S3 storage | `S3_ENDPOINT`, `S3_BUCKET`, keys | Documents stored locally |
| AI provider | `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | Rules-only classification |
| Email feed | `COLLECTION_EMAIL_HOST`, `COLLECTION_EMAIL_USER`, `COLLECTION_EMAIL_PASSWORD` | Email connector disabled |
| Transactional email | `EMAIL_PROVIDER`, provider key | No email alerts |
| Newspaper feeds | Licensed feed / permission | Manual entry only |
| SPPRA / BPPRA / Punjab / KPPRA | Reachable permitted endpoints | Manual entry only |

No credential is required for EPMS, AJK or GB, which read public pages
anonymously.

---

## 7. Deployment requirements

- **Node.js** 20.9+ (verified 24.22.3) and **pnpm** 10.18.3.
- **PostgreSQL** 15+ (verified 17.6) with migrations applied
  (`pnpm db:deploy`) and reference data seeded (`pnpm db:seed`).
- **Redis** 7+ (verified 8.10.3) reachable at `REDIS_URL` for scheduling. The
  platform still runs without it, but scheduled collection stays off.
- **Disk** for `apps/api/storage/collection` (or S3 configured) sized for tender
  documents; OCR temporarily uses more space.
- **Outbound HTTPS** from the API host to `epms.ppra.gov.pk`, `ajkppra.gov.pk` and
  `gbppra.gov.pk`.
- **Tesseract language data** downloaded on first OCR run (network access), or
  pre-seeded for an offline host.
- **One worker process** at minimum with `COLLECTION_WORKER_ENABLED=true`.
- **Cron/timezone**: reconciliation jobs use `Asia/Karachi`.
- Change the seeded Super Admin password and set production secrets before launch.

---

## 8. Known limitations

- Source reachability depends on the deployment network; several provincial
  portals were unreachable during setup and remain manual-only.
- OCR accuracy varies with scan quality; low-confidence text is flagged for
  review rather than guessed.
- Deterministic classification is less precise than an AI provider; AI output is
  labelled and optional.
- Documents are stored on local disk until S3 is configured; the host must be
  backed up.
- There is no automated test suite yet; verification is manual.
- The worker is single-process in this build; multi-instance deployments should
  be load-tested.

---

## 9. Status

The collection module is **functional and verified on the local build**. It is
ready for staging once Redis and outbound network access are confirmed and the
truncated requirement is clarified. Production launch should wait for S3,
automated tests, and re-verification of the disabled provincial sources.
