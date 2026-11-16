import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { loadEnv } from "@paktenders/config";
import {
  CurrentUser,
  RequirePermissions,
  Roles,
  type AuthUser,
} from "../../common/decorators/auth.decorators";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CollectionAdminService,
  type ImportReviewInput,
  type ManualImportInput,
  type SourceUpdateInput,
} from "./collection-admin.service";

const env = loadEnv();

const sourceStatus = z.enum(["ACTIVE", "PAUSED", "DEGRADED", "DISABLED", "PENDING_REVIEW"]);
const sourceCategory = z.enum([
  "FEDERAL",
  "PROVINCIAL",
  "AJK",
  "GILGIT_BALTISTAN",
  "DEPARTMENT",
  "HOSPITAL",
  "UNIVERSITY",
  "DEVELOPMENT_AUTHORITY",
  "PUBLIC_SECTOR",
  "NEWSPAPER",
  "PRIVATE",
]);
const runStatus = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED", "SKIPPED", "CANCELLED"]);
const ingestStatus = z.enum([
  "NEW",
  "UPDATED",
  "DUPLICATE",
  "NEEDS_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "FAILED",
]);
const tenderType = z.enum(["GOVERNMENT", "PRIVATE", "NGO", "AUCTION", "CONSULTANCY", "NEWSPAPER"]);

const listSourcesSchema = z.object({
  q: z.string().trim().max(200).optional(),
  enabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  category: sourceCategory.optional(),
  status: sourceStatus.optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const updateSourceSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    url: z.string().trim().url().max(2000).nullable().optional(),
    baseUrl: z.string().trim().url().max(2000).nullable().optional(),
    isEnabled: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    status: sourceStatus.optional(),
    priority: z.number().int().min(1).max(100).optional(),
    scheduleMinutes: z.number().int().min(5).max(1440).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(60).optional(),
    maxPages: z.number().int().min(1).max(20).optional(),
    respectRobots: z.boolean().optional(),
    autoPublish: z.boolean().optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    accessNotes: z.string().max(4000).nullable().optional(),
    licenseNotes: z.string().max(4000).nullable().optional(),
    termsUrl: z.string().trim().url().max(2000).nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

const runSourceSchema = z.object({
  force: z.boolean().optional(),
});

const listRunsSchema = z.object({
  sourceId: z.string().uuid().optional(),
  status: runStatus.optional(),
  trigger: z.enum(["SCHEDULE", "MANUAL", "RETRY", "WEBHOOK"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const listImportsSchema = z.object({
  sourceId: z.string().uuid().optional(),
  status: ingestStatus.optional(),
  q: z.string().trim().max(200).optional(),
  needsReview: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const nullableText = (max: number) => z.string().max(max).nullable().optional();
const nullableDate = z.string().datetime({ offset: true }).nullable().optional();

const manualImportSchema = z.object({
  sourceId: z.string().uuid(),
  title: z.string().trim().min(4).max(300),
  sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
  referenceNumber: nullableText(120),
  organization: nullableText(200),
  department: nullableText(200),
  category: nullableText(120),
  province: nullableText(120),
  city: nullableText(120),
  tenderType: tenderType.nullable().optional(),
  publishedAt: nullableDate,
  closingAt: nullableDate,
  openingAt: nullableDate,
  estimatedValue: z.string().trim().max(60).nullable().optional(),
  bidSecurity: z.string().trim().max(500).nullable().optional(),
  eligibility: z.string().max(4000).nullable().optional(),
  requiredDocuments: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
  contactName: nullableText(160),
  contactEmail: z.string().trim().email().max(200).nullable().optional(),
  contactPhone: nullableText(60),
  contactAddress: z.string().max(600).nullable().optional(),
  description: z.string().max(20_000).nullable().optional(),
  documentUrls: z.array(z.string().trim().url().max(2000)).max(10).optional(),
});

const uploadSchema = z.object({
  sourceId: z.string().uuid(),
  title: z.string().trim().min(4).max(300).optional(),
  sourceUrl: z.string().trim().url().max(2000).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  organization: z.string().trim().max(200).optional(),
  department: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  tenderType: tenderType.optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  closingAt: z.string().datetime({ offset: true }).optional(),
  openingAt: z.string().datetime({ offset: true }).optional(),
  estimatedValue: z.string().trim().max(60).optional(),
  bidSecurity: z.string().trim().max(500).optional(),
  eligibility: z.string().max(4000).optional(),
  contactName: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().email().max(200).optional(),
  contactPhone: z.string().trim().max(60).optional(),
  contactAddress: z.string().max(600).optional(),
  description: z.string().max(20_000).optional(),
});

const reviewSchema = z.object({
  action: z.enum(["PUBLISH", "REJECT", "NEEDS_REVIEW"]),
  notes: z.string().max(2000).optional(),
  edits: z
    .object({
      title: z.string().trim().min(4).max(300).optional(),
      referenceNumber: nullableText(120),
      description: z.string().max(20_000).optional(),
      summary: nullableText(4000),
      categoryId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      provinceId: z.string().uuid().optional(),
      cityId: z.string().uuid().nullable().optional(),
      tenderType: tenderType.optional(),
      publishedAt: nullableDate,
      closingAt: nullableDate,
      openingAt: nullableDate,
      estimatedValue: z.string().trim().max(60).nullable().optional(),
      bidSecurityAmount: z.string().trim().max(60).nullable().optional(),
      eligibility: z.string().max(4000).nullable().optional(),
      contactName: nullableText(160),
      contactEmail: z.string().trim().email().max(200).nullable().optional(),
      contactPhone: nullableText(60),
      contactAddress: z.string().max(600).nullable().optional(),
    })
    .strict()
    .optional(),
});

const listDuplicatesSchema = z.object({
  decision: z.enum(["PENDING", "MERGED", "KEPT_SEPARATE", "IGNORED"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const resolveDuplicateSchema = z.object({
  decision: z.enum(["MERGE", "KEEP_SEPARATE", "IGNORE"]),
  notes: z.string().max(2000).optional(),
});

type UploadedDocument = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

function oneLine(value: string | undefined): string | undefined {
  return value ? value.replace(/\s+/g, " ").trim() || undefined : undefined;
}

@ApiTags("admin-collection")
@ApiBearerAuth()
@Roles("SUPER_ADMIN", "ADMIN", "TENDER_MANAGER", "RESEARCHER", "VERIFICATION_OFFICER")
@Controller("admin/collection")
export class CollectionAdminController {
  constructor(private readonly admin: CollectionAdminService) {}

  @Get("overview")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Collection dashboard totals, queue state and schedules" })
  overview() {
    return this.admin.overview();
  }

  /* Sources ---------------------------------------------------------------- */

  @Get("sources")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "List configured tender sources" })
  sources(@Query(new ZodValidationPipe(listSourcesSchema)) query: z.infer<typeof listSourcesSchema>) {
    return this.admin.sources(query);
  }

  @Get("sources/:id")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Source configuration, counters and recent runs" })
  sourceDetail(@Param("id") id: string) {
    return this.admin.sourceDetail(id);
  }

  @Patch("sources/:id")
  @RequirePermissions("tender.import")
  @ApiOperation({ summary: "Enable, pause or reconfigure a source" })
  updateSource(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSourceSchema)) body: z.infer<typeof updateSourceSchema>,
  ) {
    return this.admin.updateSource(actor, id, body as SourceUpdateInput);
  }

  @Post("sources/:id/run")
  @RequirePermissions("tender.import")
  @ApiOperation({ summary: "Run a source now (queued, or synchronous when the worker is off)" })
  runSource(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(runSourceSchema)) body: z.infer<typeof runSourceSchema>,
  ) {
    return this.admin.runSource(actor, id, body.force ?? false);
  }

  /* Runs ------------------------------------------------------------------- */

  @Get("runs")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "List collection runs" })
  runs(@Query(new ZodValidationPipe(listRunsSchema)) query: z.infer<typeof listRunsSchema>) {
    return this.admin.runs(query);
  }

  @Get("runs/:id")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Run detail with imports, documents and log notes" })
  runDetail(@Param("id") id: string) {
    return this.admin.runDetail(id);
  }

  /* Imports ---------------------------------------------------------------- */

  @Get("imports")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "List collected records awaiting review" })
  imports(@Query(new ZodValidationPipe(listImportsSchema)) query: z.infer<typeof listImportsSchema>) {
    return this.admin.imports(query);
  }

  @Get("imports/:id")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Import detail: raw payload, extracted fields, provenance and reviews" })
  importDetail(@Param("id") id: string) {
    return this.admin.importDetail(id);
  }

  @Post("imports/:id/review")
  @RequirePermissions("tender.import")
  @ApiOperation({ summary: "Publish, reject or return a collected record to review" })
  reviewImport(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewSchema)) body: z.infer<typeof reviewSchema>,
  ) {
    return this.admin.reviewImport(actor, id, body as ImportReviewInput);
  }

  @Post("imports/manual")
  @RequirePermissions("tender.import")
  @ApiOperation({ summary: "Import a notice from a permitted manual source" })
  manualImport(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(manualImportSchema)) body: z.infer<typeof manualImportSchema>,
  ) {
    return this.admin.manualImport(actor, body as ManualImportInput);
  }

  @Post("imports/upload")
  @RequirePermissions("tender.import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { files: 1, fileSize: env.COLLECTION_MAX_DOCUMENT_MB * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed =
          /^application\/pdf$/i.test(file.mimetype) ||
          /^image\/(png|jpe?g|webp|tiff?)$/i.test(file.mimetype);
        callback(
          allowed ? null : new Error("Only PDF, PNG, JPEG, WebP or TIFF documents can be uploaded."),
          allowed,
        );
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a PDF or image notice and import it for review" })
  uploadImport(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body(new ZodValidationPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
  ) {
    if (!file) {
      return this.admin.manualImport(actor, body as ManualImportInput);
    }
    const fallbackTitle = file.originalname
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    return this.admin.manualImport(
      actor,
      {
        ...(body as ManualImportInput),
        title: oneLine(body.title) ?? (fallbackTitle.length >= 4 ? fallbackTitle : "Uploaded tender notice"),
      },
      {
        fileName: file.originalname,
        mimeType: file.mimetype,
        data: file.buffer,
      },
    );
  }

  /* Duplicates ------------------------------------------------------------- */

  @Get("duplicates")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Possible duplicate notices and their resolution state" })
  duplicates(
    @Query(new ZodValidationPipe(listDuplicatesSchema)) query: z.infer<typeof listDuplicatesSchema>,
  ) {
    return this.admin.duplicates(query);
  }

  @Post("duplicates/:id/resolve")
  @RequirePermissions("tender.import")
  @ApiOperation({ summary: "Merge the candidate or keep the two notices separate" })
  resolveDuplicate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resolveDuplicateSchema)) body: z.infer<typeof resolveDuplicateSchema>,
  ) {
    return this.admin.resolveDuplicate(actor, id, body.decision, body.notes);
  }

  /* Jobs and documents ----------------------------------------------------- */

  @Get("jobs")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Queue counters and recent dead-letter entries" })
  jobs() {
    return this.admin.jobs();
  }

  @Post("jobs/dead-letters/:id/retry")
  @RequirePermissions("tender.import")
  @ApiOperation({ summary: "Re-queue the source referenced by a dead-letter entry" })
  retryDeadLetter(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.admin.retryDeadLetter(actor, id);
  }

  @Get("documents/:id/file")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Download the stored original of a collected document" })
  async documentFile(@Param("id") id: string, @Res() response: Response): Promise<void> {
    const { document, buffer } = await this.admin.documentFile(id);
    const fileName = (document.fileName ?? `document-${document.id}`).replace(/[^\w.\- ]+/g, "_");
    response.setHeader("Content-Type", document.mimeType ?? "application/octet-stream");
    response.setHeader("Content-Length", String(buffer.length));
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    response.send(buffer);
  }
}
