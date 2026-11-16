import type { RawTenderItem } from "../collection.types";
import { oneLine, parseFlexibleDate } from "../extraction/date-utils";
import { parseAmountFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";

export interface JsonApiConfig {
  apiUrl?: string;
  itemsPath?: string;
  fieldMap?: Record<string, string>;
  documentPath?: string;
  pagination?: {
    param?: string;
    start?: number;
    max?: number;
    totalPath?: string;
  } | null;
  apiKeyEnv?: string;
  apiKeyParam?: string;
  apiKeyHeader?: string;
}

const DEFAULT_FIELD_MAP: Record<string, string> = {
  title: "title",
  externalId: "id",
  sourceUrl: "url",
  referenceNumber: "reference_number",
  organization: "organization",
  department: "department",
  category: "category",
  province: "province",
  city: "city",
  tenderType: "tender_type",
  publishedAt: "published_at",
  closingAt: "closing_at",
  openingAt: "opening_at",
  estimatedValue: "estimated_value",
  bidSecurity: "bid_security",
  description: "description",
};

function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function textAt(item: unknown, path: string | undefined): string | undefined {
  if (!path) return undefined;
  const value = readPath(item, path);
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const joined = value.map((entry) => (typeof entry === "string" ? entry : "")).filter(Boolean).join(", ");
    return joined ? oneLine(joined) : undefined;
  }
  if (typeof value === "object") return undefined;
  const text = oneLine(String(value));
  return text || undefined;
}

function listAt(item: unknown, path: string | undefined): string[] {
  if (!path) return [];
  const value = readPath(item, path);
  const entries = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return entries
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        for (const key of ["url", "href", "link"]) {
          if (typeof record[key] === "string") return String(record[key]).trim();
        }
      }
      return "";
    })
    .filter((entry) => /^https?:\/\//i.test(entry));
}

/**
 * Connector for documented JSON APIs and authorised data feeds. The endpoint,
 * field names and pagination are configured per source; no undocumented
 * endpoint is guessed and no authentication is bypassed.
 */
export const jsonApiConnector: SourceConnector = {
  key: "json-api",
  label: "Authorised JSON API",
  supportsEnrichment: false,

  async collect(ctx: ConnectorContext) {
    const config = (ctx.source.config ?? {}) as JsonApiConfig;
    const apiUrl = String(config.apiUrl ?? ctx.source.url ?? ctx.source.baseUrl ?? "");
    if (!apiUrl) {
      throw new ConnectorError("This API source has no endpoint configured.", {
        code: "MISSING_CONFIG",
        retryable: false,
      });
    }

    const fieldMap = { ...DEFAULT_FIELD_MAP, ...(config.fieldMap ?? {}) };
    const itemsPath = config.itemsPath ?? "data";
    const pagination = config.pagination;
    const start = pagination?.start ?? 1;
    const max = Math.min(pagination?.max ?? 1, Math.max(1, ctx.source.maxPages), 20);
    const items = new Map<string, RawTenderItem>();
    const notes: string[] = [];
    let pagesFetched = 0;

    for (let page = start; page < start + max; page += 1) {
      const url = new URL(apiUrl);
      if (pagination?.param) url.searchParams.set(pagination.param, String(page));
      if (config.apiKeyEnv) {
        const key = process.env[config.apiKeyEnv];
        if (!key) {
          throw new ConnectorError(
            `The API key environment variable ${config.apiKeyEnv} is not set. The source stays disabled.`,
            { code: "MISSING_CREDENTIAL", retryable: false },
          );
        }
        if (config.apiKeyParam) url.searchParams.set(config.apiKeyParam, key);
      }
      if (config.apiKeyEnv && config.apiKeyHeader) {
        // Header credentials are handled by the shared client only when the
        // source is explicitly configured to use them; see below.
        notes.push("Header-based API credentials are not supported by this connector; use a query parameter.");
      }

      const { data } = await ctx.http.getJson<unknown>(url.toString());
      pagesFetched += 1;
      const rawItems = readPath(data, itemsPath);
      if (!Array.isArray(rawItems)) {
        throw new ConnectorError(
          `The API response did not contain an array at "${itemsPath}". Check the configured items path.`,
          { code: "LAYOUT_CHANGED", retryable: false },
        );
      }
      if (rawItems.length === 0) break;

      for (const rawItem of rawItems) {
        const title = textAt(rawItem, fieldMap.title);
        if (!title) continue;
        const externalId =
          textAt(rawItem, fieldMap.externalId) ??
          textAt(rawItem, fieldMap.referenceNumber) ??
          `${url.toString()}#${items.size + 1}`;
        if (items.has(externalId)) continue;

        const sourceUrl = textAt(rawItem, fieldMap.sourceUrl) ?? apiUrl;
        const publishedAt = parseFlexibleDate(textAt(rawItem, fieldMap.publishedAt), { endOfDay: false });
        const closingAt = parseFlexibleDate(textAt(rawItem, fieldMap.closingAt), { endOfDay: true });
        const openingAt = parseFlexibleDate(textAt(rawItem, fieldMap.openingAt), { endOfDay: false });
        const documentUrls = listAt(rawItem, config.documentPath);

        items.set(externalId, {
          externalId,
          sourceUrl,
          title,
          referenceNumber: textAt(rawItem, fieldMap.referenceNumber),
          organization: textAt(rawItem, fieldMap.organization),
          department: textAt(rawItem, fieldMap.department),
          category: textAt(rawItem, fieldMap.category),
          province: textAt(rawItem, fieldMap.province),
          city: textAt(rawItem, fieldMap.city),
          tenderType: textAt(rawItem, fieldMap.tenderType),
          publishedAt: publishedAt?.toISOString(),
          closingAt: closingAt?.toISOString(),
          openingAt: openingAt?.toISOString(),
          estimatedValue: parseAmountFromText(textAt(rawItem, fieldMap.estimatedValue)) ?? undefined,
          bidSecurity: parseAmountFromText(textAt(rawItem, fieldMap.bidSecurity)) ?? undefined,
          description: textAt(rawItem, fieldMap.description),
          documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
          fieldConfidence: { title: 0.9 },
          raw: { item: rawItem, endpoint: url.toString() },
        });
        if (items.size >= ctx.maxItems) break;
      }

      if (!pagination?.param || items.size >= ctx.maxItems) break;
      const total = pagination.totalPath ? Number(readPath(data, pagination.totalPath)) : Number.NaN;
      if (Number.isFinite(total) && page * (rawItems.length || 1) >= total) break;
    }

    if (items.size === 0) notes.push("The API returned no usable tender records.");
    return { items: Array.from(items.values()).slice(0, ctx.maxItems), pagesFetched, notes };
  },
};
