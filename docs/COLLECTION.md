# Tender collection, updates and monitoring

This document describes the automated tender collection module: the connector
architecture, the sources that are actually supported today, how scheduling,
extraction, OCR, duplicate detection and human review work, and how to operate
and troubleshoot the system.

The guiding rule is simple: **the platform never invents a tender.** Every record
is traceable to a source URL or an uploaded notice, extraction only fills fields
it can prove, and anything uncertain is flagged for human review.

---

## 1. What the module does

| Capability | Implementation |
| --- | --- |
| Retrieve listings from a source | Per-source connector selected by `connectorKey` |
| Detect new and changed records | `TenderImport` keyed by source + external id + raw hash |
| Download permitted documents | `SourceDocument` with local storage, SHA-256 and OCR state |
| Extract structured fields | Deterministic rules first, optional AI second |
| Support text, scanned PDFs and images | `pdf-parse` text path, Tesseract OCR (`eng+urd`) fallback |
| Detect duplicates | Exact identifiers first, then guarded fuzzy matching |
| Route records to humans | Review queue with `PUBLISH` / `REJECT` / `NEEDS_REVIEW` |
| Schedule and retry | BullMQ queues, Redis locks, exponential backoff, dead-letter queue |
| Admin control per source | Enable, pause, configure, run now, inspect runs and errors |
| Manual and file imports | Admin URL entry and PDF/image upload |

---

## 2. Source reality (verified)

Each source was inspected before a connector was written. Only sources that were
reachable and whose public listings permit automated reading are enabled.

| Source | Code | Method | Connector | State | Notes |
| --- | --- | --- | --- | --- | --- |
| PPRA EPMS public tenders | `PPRA-EPMS` | Website monitor | `epms` | **Enabled** | Public active-tender listing; anonymous read; detail pages and PDFs under `/pdf?file=…` |
| AJK PPRA active advertisements | `AJKPPRA-ACTIVE` | Website monitor | `table` | **Enabled** | Public homepage table; rows link to PDFs under `uploadfiles/tenderdocuments/` |
| GB PPRA procurements | `GBPPRA-PROC` | Website monitor | `table` | **Enabled** | Public table at `/procurements/{page}`; detail pages under `/procurementdetails/<id>`; PDFs under `/storage/proc_files/` |
| KPPRA active tenders | `KPPRA-ACTIVE` | Website monitor | `table` | Paused | Connector configured and verified; `kppra.gov.pk` did not respond from the build network |
| SPPRA tender portal | `SPPRA-PORTAL` | Manual import | `manual` | Disabled | `sppra.gos.pk` / `sppra.sindh.gov.pk` did not resolve at setup |
| BPPRA tender portal | `BPPRA-PORTAL` | Manual import | `manual` | Disabled | `/Tenders` returned HTTP 500 during review |
| PPRA Punjab | `PPRAPB-PORTAL` | Manual import | `manual` | Disabled | Punjab e-procurement connection failed during review |
| Jang classifieds | `JANG-CLASSIFIEDS` | Manual import | `manual` | Disabled | Newspaper notices need a licensed feed or subscription |
| Dawn classifieds | `DAWN-CLASSIFIEDS` | Manual import | `manual` | Disabled | Licensed feed/subscription required |
| Business Recorder tenders | `BR-TENDERS` | Manual import | `manual` | Disabled | Licensed feed/subscription required |
| Manual editorial entry | `MANUAL-ENTRY` | Manual import | `manual` | **Enabled** | Internal entry; requires a source URL or uploaded document |

No connector bypasses authentication, CAPTCHA, paywalls or access controls. A
source that is unreachable or restricted stays configured but disabled, with the
reason recorded in its `accessNotes` so the decision is auditable.

Enabling a source from the admin screen requires the source to be marked
`isVerified` first, and requires a connector that exists in this build.

---

## 3. Connector architecture

Connectors implement one small interface (`connectors/connector.types.ts`):

```ts
interface SourceConnector {
  key: string;                        // stored in TenderSource.connectorKey
  label: string;
  supportsEnrichment: boolean;        // can open a detail page for more fields
  automated: boolean;                 // fetched by the scheduler vs. imported
  collect(ctx: ConnectorContext): Promise<ConnectorResult>;
  enrich?(ctx: ConnectorContext, item: RawTenderItem): Promise<RawTenderItem>;
}
```

The registry (`connectors/connector.registry.ts`) maps keys to connectors. A
source row references a connector by key; `getConnector` throws a non-retryable
`ConnectorError` for an unknown key, and `hasConnector` is used to refuse
enabling a source whose connector is absent.

Available connectors:

| Key | Use |
| --- | --- |
| `epms` | PPRA EPMS listing and detail pages (`table.cb-rt`, `.detail-label`, `/pdf?file=…`) |
| `table` | Generic HTML table scraper with header synonyms, detail links and pagination |
| `rss` | RSS and Atom feeds, including attribute-only links |
| `json` | JSON API with a configurable item path and field map |
| `csv` | Downloadable datasets / CSV feeds |
| `document` | Monitors a published PDF or notice page for changes |
| `email` | Reads a dedicated IMAP mailbox; credentials come from environment variables |
| `manual` | Admin-entered or uploaded notices; never scheduled |

### Shared HTTP client

All fetching goes through `connectors/http-client.ts`, which enforces:

- a descriptive `User-Agent` (`COLLECTION_USER_AGENT`)
- request timeouts (`COLLECTION_HTTP_TIMEOUT_MS`)
- per-source rate limiting (`rateLimitPerMinute`)
- a maximum document size (`COLLECTION_MAX_DOCUMENT_MB`)
- robots/`respectRobots` checks where configured
- **SSRF protection**: private and loopback addresses are refused

That SSRF guard is why a test source pointed at `127.0.0.1` fails with
"Refusing to fetch a private or local address" — it is intentional.

### Table connector

The `table` connector is configurable through `TenderSource.config`:

```jsonc
{
  "listingUrl": "https://example.gov.pk/tenders",
  "pageUrlTemplate": "https://example.gov.pk/tenders/{page}",
  "columns": { "title": 1, "publishedAt": 2, "closingAt": 3, "department": 4 },
  "detailLinkSelector": "a[href*=\"/tender/\"]",
  "defaultOrganization": "Example Authority",
  "pagination": { "start": 1, "max": 3 }
}
```

When explicit column indexes are absent it falls back to header synonyms, then
to the longest cell as the title. Detail links are opened only when
`supportsEnrichment` applies, and a link is treated as a document only when
`isDocumentUrl()` recognises it (document extension, `/storage/`,
`/uploadfiles/`, or a download endpoint with a query string). Navigation links
such as `/downloads` are not mistaken for documents.

---

## 4. Scheduling and queues

### Queues

| Queue | Purpose |
| --- | --- |
| `collection` | `collect-source`, `scheduler-tick`, `reconcile-deadlines`, `reconcile-sources` |
| `collection-dlq` | Dead-letter entries after the retry budget is exhausted |

Both use the `BULLMQ_PREFIX` key prefix (default `paktenders`), so queue keys
appear as `paktenders:collection:*`. Queue names are `collection` and
`collection-dlq`.

### Schedules

| Job | Default | Configurable |
| --- | --- | --- |
| Scheduler tick | every minute | internal |
| Per-source collection | `scheduleMinutes` on the source (5–1440) | Admin |
| Deadline reconciliation | `COLLECTION_DEADLINE_CRON` (`0 2 * * *`, PKT) | env |
| Full source reconciliation | `COLLECTION_RECONCILE_CRON` (`30 2 * * *`, PKT) | env |

Priority bands are expressed through each source's `scheduleMinutes` and
`priority`:

- high priority: 5–15 minutes (federal PPRA/EPMS)
- standard: 30–60 minutes (provincial portals)
- newspapers / low frequency: 1–3 hours or manual
- document monitoring: 30–60 minutes
- daily deadline and full reconciliation

### No overlap, no duplicates

- The tick claims due sources with a **conditional `nextRunAt` update**, so two
  API instances cannot claim the same source in the same tick.
- Each source run holds a **Redis lock** (`collection:lock:source:<id>`, 30 min
  TTL). A second worker that cannot take the lock marks its queued run
  `SKIPPED` instead of double-processing.
- BullMQ job ids are deterministic (`source-<id>` / `manual-<id>`), so a source
  cannot have two queued jobs at once. A collision returns
  "A collection job for this source is already queued or running."

### Retries and dead letters

Jobs use `attempts: 3` with exponential backoff starting at 30 seconds
(30s, 60s). A run that ends `FAILED` throws so BullMQ retries. After the final
attempt the job is copied to `collection-dlq`, the source backs off, and the
entry appears in **Queue & errors** where an admin can retry it.

### Redis optional

If `REDIS_URL` is empty or `COLLECTION_WORKER_ENABLED=false`:

- the API keeps running
- scheduled collection does not start
- **Run now** falls back to a synchronous in-process run
- the admin UI reports queue readiness honestly

---

## 5. Extraction

### Field extraction order

1. **Source fields** — values parsed directly from the listing or detail page.
2. **Document text** — text PDFs are read with `pdf-parse`; scanned PDFs and
   images go through OCR.
3. **Deterministic rules** — reference number, dates, organisation, contacts,
   eligibility, bid security, category and province.
4. **Optional AI** — only for classification/normalisation/summary, and only
   when `AI_COLLECTION_ENABLED=true` and a provider is configured.

Every field records its provenance (`SOURCE`, `RULE`, `AI`, `MANUAL`) and a
confidence value. AI-derived values are never presented as source facts.

### Dates and times

- Source datetimes are parsed in `Asia/Karachi` unless they carry an offset.
- `parseTime()` only accepts unambiguous times (colon times, dotted times with
  am/pm, or a bare hour with am/pm). Ambiguous numbers are ignored rather than
  guessed.
- A date with no published time is treated as **end of day** (23:59 PKT) and
  flagged with a warning and low confidence.
- An opening date is never invented when only a time is published.

### Text extraction and OCR

| Input | Path |
| --- | --- |
| Text PDF | `pdf-parse` extracts text and page count |
| Scanned PDF | Rendered pages → Tesseract OCR (`OCR_LANGUAGES`, default `eng,urd`) |
| Image (PNG/JPEG/WebP/TIFF) | Tesseract OCR directly |
| Unsupported | Stored with `ocrStatus = UNSUPPORTED` |

OCR is capped at 8 pages per document. The original file, extracted text, page
references, language and OCR confidence are all stored. Tesseract language data
is downloaded on first use.

### Confidence and review

- Each import stores an overall `confidence` and per-field confidence.
- A record goes to `NEEDS_REVIEW` unless the source has `autoPublish = true`
  **and** the confidence meets its `minConfidence` threshold.
- Warnings such as "No closing date was found in the source" are stored in the
  import's `reviewNotes` and shown in the review screen.

Auto-publish is off by default for every seeded source.

---

## 6. Duplicate detection

Duplicates are checked in this order. Exact matches are handled automatically;
fuzzy matches always go to a human.

| Match | Condition | Outcome |
| --- | --- | --- |
| `EXACT_SOURCE_ID` | Same source + same external id | Merged into the existing tender |
| `EXACT_REFERENCE` | Same normalised reference number | Merged |
| `EXACT_DOCUMENT` | Same document SHA-256, **or** title similarity ≥ 0.8 | Merged (shared advertisement PDFs may cover several tenders, so title similarity is required) |
| `EXACT_URL` | Same notice-specific URL | Merged (site roots and listing pages are excluded via `isNoticeUrl()`) |
| `FUZZY` | Strong title + organisation + date agreement | Held as a `PENDING` review; never auto-merged |

Guards that prevent wrong merges:

- If two records publish **different non-empty reference numbers**, fuzzy matching
  is blocked (`referenceConflict`).
- Similar titles alone are never enough.
- Every decision is retained in `TenderDuplicateReview` (with signals, score,
  decision and notes). A merge archives the candidate (`ARCHIVED`, `deletedAt`
  set) and links it through `TenderImport.duplicateOfId`; the primary record is
  untouched.

Admins resolve fuzzy pairs in **Duplicates** with **Merge**, **Keep separate** or
**Ignore**.

---

## 7. Review workflow

1. A run creates a `TenderImport` for each found item.
2. Extraction and duplicate checks run.
3. New records are created as `PENDING_VERIFICATION` with `needsReview` set as
   appropriate.
4. Reviewers open **Review queue** and choose:
   - **Publish tender** → import `PUBLISHED`, tender `PUBLISHED`, verified.
   - **Reject import** → import `REJECTED`, tender archived.
   - **Keep for review** → import stays `NEEDS_REVIEW`, notes updated.
5. Reviewers can correct extracted fields before publishing.

Admin uploads are private: a `TenderDocument` created from an uploaded notice is
stored with `fileUrl = ""`, `originalUrl = null` and `isPublic = false`, so it
never appears on the public tender page or as a broken link. Staff can still
download the stored copy from the review screen.

---

## 8. Admin API

Base path `/v1/admin/collection`. All routes require a staff bearer token.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/overview` | `tender.read` | Totals, queue state, schedules |
| GET | `/sources` | `tender.read` | List sources with filters |
| GET | `/sources/:id` | `tender.read` | Source config, counters, recent runs |
| PATCH | `/sources/:id` | `tender.import` | Enable, pause or reconfigure |
| POST | `/sources/:id/run` | `tender.import` | Run now (queued or synchronous) |
| GET | `/runs` | `tender.read` | Run history |
| GET | `/runs/:id` | `tender.read` | Run detail, imports, documents, notes |
| GET | `/imports` | `tender.read` | Review queue |
| GET | `/imports/:id` | `tender.read` | Raw payload, extracted fields, provenance, reviews |
| POST | `/imports/:id/review` | `tender.import` | Publish / reject / keep for review |
| POST | `/imports/manual` | `tender.import` | Import a notice from a manual source |
| POST | `/imports/upload` | `tender.import` | Upload a PDF/image notice |
| GET | `/duplicates` | `tender.read` | Possible duplicates and decisions |
| POST | `/duplicates/:id/resolve` | `tender.import` | Merge / keep separate / ignore |
| GET | `/jobs` | `tender.read` | Queue counters and dead letters |
| POST | `/jobs/dead-letters/:id/retry` | `tender.import` | Re-queue a failed source |
| GET | `/documents/:id/file` | `tender.read` | Download a stored original |

Publishing and merging additionally require `tender.publish`.

Manual imports accept ISO-8601 datetimes with an offset; the web form converts
`datetime-local` input from PKT to `+05:00`. A manual import must include a
source URL or an uploaded document.

---

## 9. Admin UI

All screens live under `/admin/collection` with a shared tab bar:

| Page | Purpose |
| --- | --- |
| `/admin/collection` | Overview: source health, queue, recent runs, review backlog |
| `/admin/collection/sources` | Enable/pause, filter, run now |
| `/admin/collection/sources/[id]` | Edit schedule, rate limit, pages, config, access notes |
| `/admin/collection/runs` | Every scheduled, manual and retried run |
| `/admin/collection/runs/[id]` | Run detail, per-item outcomes, documents |
| `/admin/collection/review` | Records awaiting review |
| `/admin/collection/review/[id]` | Extracted fields, raw payload, provenance, document preview, decisions |
| `/admin/collection/duplicates` | Fuzzy duplicate decisions |
| `/admin/collection/import` | Manual URL entry and file upload |
| `/admin/collection/jobs` | Queue health and dead-letter retry |

The stored-document download is proxied through a Next.js route handler
(`/admin/collection/documents/[id]`) so the API token stays server-side.

---

## 10. Storage

Original documents are stored on disk under `apps/api/storage/collection/<source-slug>/<year-month>/<sha256>.<ext>`
until object storage is configured. Each `SourceDocument` stores the source URL,
final URL, file name, MIME type, HTTP status, byte length, SHA-256, storage path,
extracted text, page references, OCR status and OCR confidence.

When S3 is configured the document store can be pointed at the bucket; until
then local storage is the source of truth and the path is never exposed to the
public API.

---

## 11. Operations

### Run a source manually

1. Open **Collection → Sources**.
2. Use **Run now** on the source (or open the source and run it there).
3. Watch **Runs** for the outcome and **Review queue** for new records.

If the worker is disabled, the run executes synchronously and the page waits for
the result.

### Investigate a failure

1. **Queue & errors** shows dead-letter entries and queue counters.
2. **Runs** shows the failed run with its error summary.
3. Open the source detail to read `lastError` and the access notes.
4. Fix the configuration, then **Retry** the dead letter or **Run now**.

### Restart behaviour

The scheduler tick claims every source whose `nextRunAt` is in the past. After a
long stop, overdue sources therefore run once on the next tick (a deliberate
catch-up, not a duplicate run). If you do not want that catch-up, push
`nextRunAt` into the future before starting the API.

### Recover a stuck queue

Stop the API, clear the queue with `obliterate({ force: true })` under prefix
`paktenders`, delete any `collection:lock:source:*` keys, then restart. The API
re-registers the schedulers on boot.

### Clean up test data

The following removes collected data while keeping reference data and the source
registry:

```sql
BEGIN;
DELETE FROM tender_duplicate_reviews;
DELETE FROM tender_imports;
DELETE FROM source_documents;
DELETE FROM source_runs;
DELETE FROM tenders WHERE "sourceId" IS NOT NULL AND "isDemo" = false;
COMMIT;
```

Then delete `apps/api/storage/collection/*`. The `isDemo = false` guard keeps the
flagged demo tenders, which also reference a source row. After cleaning, reset
the schedule so the worker does not immediately catch up:

```sql
UPDATE tender_sources
SET "nextRunAt" = now() + ("scheduleMinutes" || ' minutes')::interval
WHERE "isEnabled" AND "collectionMethod" <> 'MANUAL_IMPORT';
```

---

## 12. Security and rate limits

- Requests use a descriptive User-Agent and a configurable timeout.
- Per-source `rateLimitPerMinute` is enforced by the shared HTTP client.
- `respectRobots` is honoured where the source requires it.
- Private and loopback addresses are refused (SSRF guard).
- Email credentials are read from environment variables, never the database.
- Document downloads are authenticated admin routes; public tender pages only
  expose `isPublic = true` documents.
- Admin writes are audited.
- Source `configJson` is never serialised to the client; only safe summary fields
  are returned.

---

## 13. Environment variables

See [CONFIGURATION.md](CONFIGURATION.md#5-optional-integrations) for the full
list. Collection-specific variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `COLLECTION_ENABLED` | `true` | Master switch for the queue and worker |
| `COLLECTION_WORKER_ENABLED` | `true` | Start the BullMQ worker in this process |
| `COLLECTION_CONCURRENCY` | `2` | Worker concurrency (local build uses `4`) |
| `COLLECTION_USER_AGENT` | `PakTendersBot/1.0 …` | Outbound User-Agent |
| `COLLECTION_HTTP_TIMEOUT_MS` | `30000` | Fetch timeout |
| `COLLECTION_MAX_DOCUMENT_MB` | `25` | Maximum document size |
| `COLLECTION_MAX_ITEMS_PER_RUN` | `100` | Items processed per run |
| `COLLECTION_DEADLINE_CRON` | `0 2 * * *` | Daily deadline reconciliation (PKT) |
| `COLLECTION_RECONCILE_CRON` | `30 2 * * *` | Daily full reconciliation (PKT) |
| `OCR_ENABLED` | `true` | Enable Tesseract OCR |
| `OCR_LANGUAGES` | `eng,urd` | OCR languages |
| `AI_COLLECTION_ENABLED` | `true` | Allow AI enrichment when a provider exists |
| `BULLMQ_PREFIX` | `paktenders` | Queue key prefix |
| `COLLECTION_EMAIL_HOST` | empty | IMAP host for the email connector |
| `COLLECTION_EMAIL_USER` | empty | IMAP user |
| `COLLECTION_EMAIL_PASSWORD` | empty | IMAP password (referenced by name from source config) |

---

## 14. Known limitations

- **Reachability is environment-dependent.** SPPRA, BPPRA and Punjab e-procurement
  were unreachable or erroring at setup; their connectors are manual-only until a
  reachable, permitted endpoint is confirmed. KPPRA is configured but paused
  because its host did not respond from the build network.
- **Newspaper feeds need a licence.** Classified sections are manual-only until a
  licensed feed or written permission exists.
- **OCR quality varies.** Scanned notices produce imperfect text; low-confidence
  extraction is flagged for review rather than guessed.
- **AI is optional.** Without a provider, classification relies on deterministic
  rules and may be less precise; AI fields are labelled when used.
- **Local storage.** Documents live on the API host's disk until S3 is
  configured; the host must be backed up and have enough space.
- **No automated test suite.** Verification is manual (see the completion report).
- **Single-process worker.** Concurrency and locks prevent double processing, but
  a multi-instance deployment should still be load-tested before scaling.

---

## 15. Verification summary

Manual end-to-end checks performed on the local build:

- EPMS bulk run: 50 items found, 49 routed to review, 1 duplicate, documents stored.
- AJK run: distinct imports, distinct PDF URLs, 0 false duplicates.
- GB run: 10 items, 10 review, 10 documents, HTTP 200, correct titles and references.
- OCR: scanned GB PDF → `ocrStatus=COMPLETED`, ~0.91 confidence, 1,988 characters;
  a PNG containing English and Urdu → ~0.94 confidence.
- Extraction: reference, organisation, published/closing times, eligibility, bid
  security and email parsed correctly after fixes.
- Manual image upload: `201`, `NEEDS_REVIEW`, document stored, fields correct,
  `TenderDocument.isPublic = false`.
- Retry/dead letter: a failing source retried at 30s/60s, produced one DLQ entry,
  and the admin Retry cleared it.
- Duplicate resolution: fuzzy pair kept separate; second fuzzy pair merged with
  the candidate archived and the primary intact.
- Public exposure: a published upload showed `documents: 0` publicly while staff
  could still download the stored copy.

See [COLLECTION-REPORT.md](COLLECTION-REPORT.md) for the full report.
