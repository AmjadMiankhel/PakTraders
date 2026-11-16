"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/lib/server-api";

export type ActionResult = { ok: boolean; message?: string; redirectTo?: string };

function toResult(error: unknown): ActionResult {
  if (error instanceof ApiError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { ok: false, message: "The request timed out. Please try again." };
  }
  return { ok: false, message: "Something went wrong. Please try again." };
}

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function number(form: FormData, key: string): number | undefined {
  const value = text(form, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

function jsonBody(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

/* ------------------------------- tenders -------------------------------- */

export async function toggleSavedTender(
  tenderId: string,
  save: boolean,
  slug: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/me/saved-tenders/${encodeURIComponent(tenderId)}`, {
      method: save ? "POST" : "DELETE",
    });
    revalidatePath(`/tenders/${slug}`);
    revalidatePath("/dashboard/saved");
    revalidatePath("/dashboard");
    return { ok: true, message: save ? "Tender saved" : "Removed from saved" };
  } catch (error) {
    return toResult(error);
  }
}

/* -------------------------------- account ------------------------------- */

export async function updateProfile(form: FormData): Promise<ActionResult> {
  const keywords = text(form, "preferredKeywords");
  try {
    await apiFetch("/v1/me/profile", {
      method: "PATCH",
      body: jsonBody({
        fullName: text(form, "fullName"),
        phone: text(form, "phone") ?? "",
        jobTitle: text(form, "jobTitle") ?? "",
        bio: text(form, "bio") ?? "",
        provinceId: text(form, "provinceId") ?? null,
        cityId: text(form, "cityId") ?? null,
        preferredKeywords: keywords
          ? keywords
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
              .slice(0, 20)
          : [],
        marketingOptIn: bool(form, "marketingOptIn"),
      }),
    });
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { ok: true, message: "Profile updated" };
  } catch (error) {
    return toResult(error);
  }
}

export async function updatePreferences(form: FormData): Promise<ActionResult> {
  try {
    await apiFetch("/v1/me/preferences", {
      method: "PATCH",
      body: jsonBody({
        language: form.get("language") === "ur" ? "ur" : "en",
        theme: "system",
        pushEnabled: bool(form, "pushEnabled"),
        emailEnabled: bool(form, "emailEnabled"),
        digestFrequency:
          form.get("digestFrequency") === "INSTANT"
            ? "INSTANT"
            : form.get("digestFrequency") === "WEEKLY"
              ? "WEEKLY"
              : "DAILY",
        whatsappEnabled: bool(form, "whatsappEnabled"),
        smsEnabled: bool(form, "smsEnabled"),
      }),
    });
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Notification preferences updated" };
  } catch (error) {
    return toResult(error);
  }
}

export async function createAlert(form: FormData): Promise<ActionResult> {
  const name = text(form, "name");
  const q = text(form, "q");
  if (!name) return { ok: false, message: "Give your alert a name" };
  const channels = form.getAll("channels").map(String);
  try {
    await apiFetch("/v1/me/alerts", {
      method: "POST",
      body: jsonBody({
        name,
        queryJson: { q: q ?? "" },
        frequency: form.get("frequency") ?? "DAILY",
        channels: channels.length > 0 ? channels : ["IN_APP"],
        isActive: true,
      }),
    });
    revalidatePath("/dashboard/alerts");
    return { ok: true, message: "Alert created" };
  } catch (error) {
    return toResult(error);
  }
}

export async function toggleAlert(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/me/alerts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: jsonBody({ isActive }),
    });
    revalidatePath("/dashboard/alerts");
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function deleteAlert(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/me/alerts/${encodeURIComponent(id)}`, { method: "DELETE" });
    revalidatePath("/dashboard/alerts");
    return { ok: true, message: "Alert deleted" };
  } catch (error) {
    return toResult(error);
  }
}

export async function createSavedSearch(form: FormData): Promise<ActionResult> {
  const name = text(form, "name");
  if (!name) return { ok: false, message: "Give this search a name" };
  try {
    await apiFetch("/v1/me/saved-searches", {
      method: "POST",
      body: jsonBody({
        name,
        queryJson: {
          q: text(form, "q") ?? "",
          category: text(form, "category") ?? "",
          province: text(form, "province") ?? "",
        },
      }),
    });
    revalidatePath("/dashboard/searches");
    return { ok: true, message: "Search saved" };
  } catch (error) {
    return toResult(error);
  }
}

export async function deleteSavedSearch(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/me/saved-searches/${encodeURIComponent(id)}`, { method: "DELETE" });
    revalidatePath("/dashboard/searches");
    return { ok: true, message: "Saved search deleted" };
  } catch (error) {
    return toResult(error);
  }
}

export async function markNotificationsRead(): Promise<ActionResult> {
  try {
    await apiFetch("/v1/me/notifications/read", { method: "PATCH", body: jsonBody({}) });
    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");
    return { ok: true, message: "Notifications marked as read" };
  } catch (error) {
    return toResult(error);
  }
}

export async function deleteAccount(form: FormData): Promise<ActionResult> {
  if (form.get("confirmation") !== "DELETE") {
    return { ok: false, message: 'Type DELETE exactly to confirm' };
  }
  try {
    await apiFetch("/v1/me/account", {
      method: "DELETE",
      body: jsonBody({ confirmation: "DELETE" }),
    });
    return { ok: true, message: "Account deleted" };
  } catch (error) {
    return toResult(error);
  }
}

/* --------------------------------- admin -------------------------------- */

export async function updateUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/admin/users/${encodeURIComponent(userId)}/status`, {
      method: "PATCH",
      body: jsonBody({ status }),
    });
    revalidatePath("/admin/users");
    return { ok: true, message: `User ${status === "ACTIVE" ? "activated" : "suspended"}` };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateSetting(form: FormData): Promise<ActionResult> {
  const key = text(form, "key");
  const raw = text(form, "value");
  if (!key) return { ok: false, message: "Missing setting key" };
  let value: unknown = raw ?? null;
  if (raw !== undefined) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
  }
  try {
    await apiFetch("/v1/admin/settings", {
      method: "PATCH",
      body: jsonBody({ key, value }),
    });
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
    return { ok: true, message: "Setting saved" };
  } catch (error) {
    return toResult(error);
  }
}

export async function setTenderStatus(tenderId: string, status: string): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/admin/tenders/${encodeURIComponent(tenderId)}/status`, {
      method: "POST",
      body: jsonBody({ status }),
    });
    revalidatePath("/admin/tenders");
    revalidatePath("/tenders");
    return { ok: true, message: `Tender moved to ${status.replaceAll("_", " ").toLowerCase()}` };
  } catch (error) {
    return toResult(error);
  }
}

export async function verifyTender(
  tenderId: string,
  status: "VERIFIED" | "PENDING" | "UNVERIFIED",
): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/admin/tenders/${encodeURIComponent(tenderId)}/verify`, {
      method: "POST",
      body: jsonBody({ status }),
    });
    revalidatePath("/admin/tenders");
    return { ok: true, message: `Verification set to ${status.toLowerCase()}` };
  } catch (error) {
    return toResult(error);
  }
}

export async function deleteTender(tenderId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/admin/tenders/${encodeURIComponent(tenderId)}`, { method: "DELETE" });
    revalidatePath("/admin/tenders");
    revalidatePath("/tenders");
    return { ok: true, message: "Tender deleted" };
  } catch (error) {
    return toResult(error);
  }
}

/**
 * datetime-local inputs submit "YYYY-MM-DDTHH:mm" without a timezone. Admin
 * forms label these as Pakistan Standard Time, so pin the UTC+5 offset before
 * sending the value to the API.
 */
function dateTimePkt(form: FormData, key: string): string | null {
  const value = text(form, key);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00+05:00`;
  return value;
}

function tenderPayload(form: FormData): Record<string, unknown> {
  const requiredDocuments = (text(form, "requiredDocuments") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50);

  return {
    title: text(form, "title"),
    referenceNumber: text(form, "referenceNumber"),
    description: text(form, "description"),
    summary: text(form, "summary"),
    categoryId: text(form, "categoryId"),
    departmentId: text(form, "departmentId"),
    provinceId: text(form, "provinceId"),
    cityId: text(form, "cityId") ?? null,
    sourceId: text(form, "sourceId") ?? null,
    tenderType: text(form, "tenderType") ?? "GOVERNMENT",
    status: text(form, "status") ?? "DRAFT",
    verificationStatus: text(form, "verificationStatus") ?? "UNVERIFIED",
    publishedAt: dateTimePkt(form, "publishedAt"),
    closingAt: dateTimePkt(form, "closingAt"),
    openingAt: dateTimePkt(form, "openingAt"),
    estimatedValue: number(form, "estimatedValue") ?? null,
    eligibility: text(form, "eligibility"),
    bidSecurityAmount: number(form, "bidSecurityAmount") ?? null,
    bidSecurityDetails: text(form, "bidSecurityDetails"),
    requiredDocuments,
    contactName: text(form, "contactName"),
    contactEmail: text(form, "contactEmail"),
    contactPhone: text(form, "contactPhone"),
    contactAddress: text(form, "contactAddress"),
    originalUrl: text(form, "originalUrl"),
    sourceAttribution: text(form, "sourceAttribution"),
    isFeatured: bool(form, "isFeatured"),
  };
}

export async function createTender(form: FormData): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>("/v1/admin/tenders", {
      method: "POST",
      body: jsonBody(tenderPayload(form)),
    });
    revalidatePath("/admin/tenders");
    revalidatePath("/tenders");
    return { ok: true, message: `Tender created (${created.id.slice(0, 8)}…)` };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateTender(form: FormData): Promise<ActionResult> {
  const id = text(form, "id");
  if (!id) return { ok: false, message: "Missing tender id" };
  try {
    await apiFetch(`/v1/admin/tenders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: jsonBody(tenderPayload(form)),
    });
    revalidatePath("/admin/tenders");
    revalidatePath(`/admin/tenders/${id}`);
    return { ok: true, message: "Tender updated" };
  } catch (error) {
    return toResult(error);
  }
}

/* ------------------------------ collection ------------------------------ */

function revalidateCollection(sourceId?: string): void {
  revalidatePath("/admin/collection");
  revalidatePath("/admin/collection/sources");
  revalidatePath("/admin/collection/runs");
  revalidatePath("/admin/collection/review");
  revalidatePath("/admin/collection/duplicates");
  revalidatePath("/admin/collection/jobs");
  if (sourceId) revalidatePath(`/admin/collection/sources/${sourceId}`);
}

/** datetime-local (PKT) -> ISO with +05:00; empty means "clear the value". */
function nullableDateTimePkt(form: FormData, key: string): string | null | undefined {
  const raw = form.get(key);
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00+05:00`;
  return value;
}

export async function runCollectionSource(sourceId: string, force = false): Promise<ActionResult> {
  try {
    const result = await apiFetch<{
      queued: boolean;
      runId: string;
      summary: { status?: string } | null;
    }>(`/v1/admin/collection/sources/${encodeURIComponent(sourceId)}/run`, {
      method: "POST",
      body: jsonBody({ force }),
    });
    revalidateCollection(sourceId);
    const detail = result.summary?.status
      ? `finished with status ${result.summary.status.replaceAll("_", " ").toLowerCase()}`
      : "queued for the collection worker";
    return { ok: true, message: `Run ${detail} (${result.runId.slice(0, 8)}…)` };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateCollectionSource(form: FormData): Promise<ActionResult> {
  const id = text(form, "id");
  if (!id) return { ok: false, message: "Missing source id" };

  let config: Record<string, unknown> | null = null;
  const configRaw = text(form, "config");
  if (configRaw) {
    try {
      const parsed: unknown = JSON.parse(configRaw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, message: "Connector config must be a JSON object." };
      }
      config = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, message: "Connector config is not valid JSON." };
    }
  }

  try {
    await apiFetch(`/v1/admin/collection/sources/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: jsonBody({
        name: text(form, "name"),
        url: text(form, "url") ?? null,
        baseUrl: text(form, "baseUrl") ?? null,
        isEnabled: bool(form, "isEnabled"),
        isVerified: bool(form, "isVerified"),
        status: text(form, "status"),
        priority: number(form, "priority"),
        scheduleMinutes: number(form, "scheduleMinutes"),
        rateLimitPerMinute: number(form, "rateLimitPerMinute"),
        maxPages: number(form, "maxPages"),
        respectRobots: bool(form, "respectRobots"),
        autoPublish: bool(form, "autoPublish"),
        minConfidence: number(form, "minConfidence"),
        accessNotes: text(form, "accessNotes") ?? null,
        licenseNotes: text(form, "licenseNotes") ?? null,
        termsUrl: text(form, "termsUrl") ?? null,
        config,
      }),
    });
    revalidateCollection(id);
    return { ok: true, message: "Source configuration saved" };
  } catch (error) {
    return toResult(error);
  }
}

export async function reviewCollectionImport(form: FormData): Promise<ActionResult> {
  const id = text(form, "id");
  const action = text(form, "reviewAction");
  if (!id) return { ok: false, message: "Missing import id" };
  if (action !== "PUBLISH" && action !== "REJECT" && action !== "NEEDS_REVIEW") {
    return { ok: false, message: "Choose publish, reject or send back to review." };
  }

  const edits: Record<string, unknown> = {};
  const title = text(form, "title");
  if (title) edits.title = title;
  if (form.has("referenceNumber")) edits.referenceNumber = text(form, "referenceNumber") ?? null;
  if (form.has("summary")) edits.summary = text(form, "summary") ?? null;
  if (form.has("description")) edits.description = text(form, "description") ?? "";
  const categoryId = text(form, "categoryId");
  if (categoryId) edits.categoryId = categoryId;
  const departmentId = text(form, "departmentId");
  if (departmentId) edits.departmentId = departmentId;
  const provinceId = text(form, "provinceId");
  if (provinceId) edits.provinceId = provinceId;
  if (form.has("cityId")) edits.cityId = text(form, "cityId") ?? null;
  const tenderType = text(form, "tenderType");
  if (tenderType) edits.tenderType = tenderType;
  for (const key of ["publishedAt", "closingAt", "openingAt"] as const) {
    const value = nullableDateTimePkt(form, key);
    if (value !== undefined) edits[key] = value;
  }
  const estimatedValue = text(form, "estimatedValue");
  if (estimatedValue !== undefined) edits.estimatedValue = estimatedValue;
  const bidSecurityAmount = text(form, "bidSecurityAmount");
  if (bidSecurityAmount !== undefined) edits.bidSecurityAmount = bidSecurityAmount;
  const eligibility = text(form, "eligibility");
  if (eligibility !== undefined) edits.eligibility = eligibility;
  const contactName = text(form, "contactName");
  if (contactName !== undefined) edits.contactName = contactName;
  const contactEmail = text(form, "contactEmail");
  if (contactEmail !== undefined) edits.contactEmail = contactEmail;
  const contactPhone = text(form, "contactPhone");
  if (contactPhone !== undefined) edits.contactPhone = contactPhone;
  const contactAddress = text(form, "contactAddress");
  if (contactAddress !== undefined) edits.contactAddress = contactAddress;

  try {
    await apiFetch(`/v1/admin/collection/imports/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: jsonBody({
        action,
        notes: text(form, "notes"),
        edits: Object.keys(edits).length > 0 ? edits : undefined,
      }),
    });
    revalidateCollection();
    revalidatePath(`/admin/collection/review/${id}`);
    revalidatePath("/admin/tenders");
    revalidatePath("/tenders");
    return {
      ok: true,
      message:
        action === "PUBLISH"
          ? "Import published"
          : action === "REJECT"
            ? "Import rejected"
            : "Import returned for review",
      redirectTo: "/admin/collection/review",
    };
  } catch (error) {
    return toResult(error);
  }
}

export async function resolveCollectionDuplicate(
  reviewId: string,
  decision: "MERGE" | "KEEP_SEPARATE" | "IGNORE",
): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/admin/collection/duplicates/${encodeURIComponent(reviewId)}/resolve`, {
      method: "POST",
      body: jsonBody({ decision }),
    });
    revalidateCollection();
    revalidatePath("/admin/tenders");
    return {
      ok: true,
      message:
        decision === "MERGE"
          ? "Notices merged"
          : decision === "KEEP_SEPARATE"
            ? "Notices kept separate"
            : "Duplicate suggestion ignored",
    };
  } catch (error) {
    return toResult(error);
  }
}

export async function retryCollectionDeadLetter(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/v1/admin/collection/jobs/dead-letters/${encodeURIComponent(id)}/retry`, {
      method: "POST",
      body: jsonBody({}),
    });
    revalidateCollection();
    return { ok: true, message: "Source re-queued" };
  } catch (error) {
    return toResult(error);
  }
}

function manualImportPayload(form: FormData): Record<string, unknown> {
  const documentUrls = (text(form, "documentUrls") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
  const requiredDocuments = (text(form, "requiredDocuments") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50);

  return {
    sourceId: text(form, "sourceId"),
    title: text(form, "title"),
    sourceUrl: text(form, "sourceUrl") ?? null,
    referenceNumber: text(form, "referenceNumber") ?? null,
    organization: text(form, "organization") ?? null,
    department: text(form, "department") ?? null,
    category: text(form, "category") ?? null,
    province: text(form, "province") ?? null,
    city: text(form, "city") ?? null,
    tenderType: text(form, "tenderType") ?? null,
    publishedAt: nullableDateTimePkt(form, "publishedAt") ?? null,
    closingAt: nullableDateTimePkt(form, "closingAt") ?? null,
    openingAt: nullableDateTimePkt(form, "openingAt") ?? null,
    estimatedValue: text(form, "estimatedValue") ?? null,
    bidSecurity: text(form, "bidSecurity") ?? null,
    eligibility: text(form, "eligibility") ?? null,
    requiredDocuments: requiredDocuments.length > 0 ? requiredDocuments : undefined,
    contactName: text(form, "contactName") ?? null,
    contactEmail: text(form, "contactEmail") ?? null,
    contactPhone: text(form, "contactPhone") ?? null,
    contactAddress: text(form, "contactAddress") ?? null,
    description: text(form, "description") ?? null,
    documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
  };
}

export async function createCollectionManualImport(form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  const hasFile = typeof File !== "undefined" && file instanceof File && file.size > 0;
  const sourceId = text(form, "sourceId");
  if (!sourceId) return { ok: false, message: "Choose the source this notice came from." };

  try {
    let result: { import: { id: string; status: string } | null };
    if (hasFile) {
      const upload = new FormData();
      for (const [key, value] of Object.entries(manualImportPayload(form))) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value)) {
          for (const entry of value) upload.append(key, String(entry));
          continue;
        }
        upload.append(key, String(value));
      }
      upload.append("file", file as File);
      result = await apiFetch<{ import: { id: string; status: string } | null }>(
        "/v1/admin/collection/imports/upload",
        { method: "POST", body: upload },
      );
    } else {
      result = await apiFetch<{ import: { id: string; status: string } | null }>(
        "/v1/admin/collection/imports/manual",
        { method: "POST", body: jsonBody(manualImportPayload(form)) },
      );
    }
    revalidateCollection();
    revalidatePath("/admin/collection/review");
    const status = result.import?.status ?? "NEW";
    return {
      ok: true,
      message: `Notice imported (${status.replaceAll("_", " ").toLowerCase()}).`,
      redirectTo: result.import?.id ? `/admin/collection/review/${result.import.id}` : "/admin/collection/review",
    };
  } catch (error) {
    return toResult(error);
  }
}
