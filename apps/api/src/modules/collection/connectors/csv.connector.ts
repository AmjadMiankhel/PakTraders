import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import type { RawTenderItem } from "../collection.types";
import { oneLine, parseFlexibleDate } from "../extraction/date-utils";
import { parseAmountFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";

export interface CsvConfig {
  csvUrl?: string;
  delimiter?: string;
  columns?: Record<string, string>;
  encoding?: string;
}

const HEADER_CANDIDATES: Record<string, string[]> = {
  title: ["tender title", "title", "subject", "procurement title", "description", "name"],
  referenceNumber: ["tender no", "reference", "ref no", "nit", "tender reference", "bid no"],
  organization: ["procuring agency", "organization", "organisation", "department", "office", "entity"],
  category: ["category", "sector", "procurement category"],
  province: ["province", "region"],
  city: ["city", "district"],
  tenderType: ["tender type", "type", "procurement type"],
  publishedAt: ["publishing date", "published date", "publication date", "advertisement date", "advertised", "published"],
  closingAt: ["closing date", "closing", "deadline", "submission deadline", "bid closing"],
  openingAt: ["opening date", "opening", "bid opening"],
  estimatedValue: ["estimated cost", "estimated value", "tender value", "cost"],
  bidSecurity: ["earnest money", "bid security", "emd", "security"],
  description: ["details", "description", "scope"],
  sourceUrl: ["url", "link", "tender url", "source url"],
  externalId: ["id", "record id", "tender id"],
  documentUrls: ["documents", "document url", "attachment", "pdf", "tender document"],
};

function decode(buffer: Buffer, encoding: string | undefined): string {
  try {
    return new TextDecoder(encoding && encoding !== "utf-8" ? encoding : "utf-8").decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}

function resolveColumn(headers: string[], config: CsvConfig, field: string): string | undefined {
  const explicit = config.columns?.[field];
  if (explicit) return explicit;
  const candidates = HEADER_CANDIDATES[field] ?? [];
  for (const candidate of candidates) {
    const match = headers.find((header) => header.toLowerCase().includes(candidate));
    if (match) return match;
  }
  return undefined;
}

function valueOf(row: Record<string, string>, column: string | undefined): string | undefined {
  if (!column) return undefined;
  const raw = row[column];
  if (raw === undefined) return undefined;
  const text = oneLine(raw);
  return text || undefined;
}

function splitUrls(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((entry) => entry.trim())
        .filter((entry) => /^https?:\/\//i.test(entry)),
    ),
  );
}

/**
 * CSV/dataset connector for downloadable official datasets. Column names are
 * mapped explicitly in the source configuration, with a conservative
 * auto-detection fallback for common Pakistani portal headers.
 */
export const csvConnector: SourceConnector = {
  key: "csv",
  label: "Downloadable CSV dataset",
  supportsEnrichment: false,

  async collect(ctx: ConnectorContext) {
    const config = (ctx.source.config ?? {}) as CsvConfig;
    const csvUrl = String(config.csvUrl ?? ctx.source.url ?? ctx.source.baseUrl ?? "");
    if (!csvUrl) {
      throw new ConnectorError("This dataset source has no CSV URL configured.", {
        code: "MISSING_CONFIG",
        retryable: false,
      });
    }

    const response = await ctx.http.request(csvUrl, { accept: "text/csv,text/plain,application/csv,*/*" });
    const text = decode(response.body, config.encoding);
    let rows: Array<Record<string, string>>;
    try {
      rows = parseCsv(text, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        delimiter: config.delimiter ?? ",",
        trim: true,
      }) as Array<Record<string, string>>;
    } catch (error) {
      throw new ConnectorError(
        `CSV could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
        { code: "INVALID_CSV", retryable: false },
      );
    }

    if (rows.length === 0) {
      throw new ConnectorError("The CSV dataset contained no rows.", { code: "EMPTY_DATASET", retryable: false });
    }

    const headers = Object.keys(rows[0] ?? {});
    const columns = Object.fromEntries(
      Object.keys(HEADER_CANDIDATES).map((field) => [field, resolveColumn(headers, config, field)]),
    ) as Record<string, string | undefined>;

    const items = new Map<string, RawTenderItem>();
    const notes: string[] = [];
    for (const row of rows.slice(0, ctx.maxItems)) {
      const title = valueOf(row, columns.title);
      if (!title) continue;
      const reference = valueOf(row, columns.referenceNumber);
      const sourceUrl = valueOf(row, columns.sourceUrl) ?? csvUrl;
      const externalId =
        valueOf(row, columns.externalId) ??
        reference ??
        createHash("sha1").update(`${csvUrl}|${JSON.stringify(row)}`).digest("hex").slice(0, 20);

      const publishedAt = parseFlexibleDate(valueOf(row, columns.publishedAt), { endOfDay: false });
      const closingAt = parseFlexibleDate(valueOf(row, columns.closingAt), { endOfDay: true });
      const openingAt = parseFlexibleDate(valueOf(row, columns.openingAt), { endOfDay: false });
      const documentUrls = splitUrls(valueOf(row, columns.documentUrls));

      items.set(externalId, {
        externalId,
        sourceUrl,
        title,
        referenceNumber: reference,
        organization: valueOf(row, columns.organization),
        category: valueOf(row, columns.category),
        province: valueOf(row, columns.province),
        city: valueOf(row, columns.city),
        tenderType: valueOf(row, columns.tenderType),
        publishedAt: publishedAt?.toISOString(),
        closingAt: closingAt?.toISOString(),
        openingAt: openingAt?.toISOString(),
        estimatedValue: parseAmountFromText(valueOf(row, columns.estimatedValue)) ?? undefined,
        bidSecurity: parseAmountFromText(valueOf(row, columns.bidSecurity)) ?? undefined,
        description: valueOf(row, columns.description),
        documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
        fieldConfidence: { title: 0.85 },
        raw: { row },
      });
    }

    if (items.size === 0) notes.push("CSV rows were present but none had a usable title.");
    return { items: Array.from(items.values()), pagesFetched: 1, notes };
  },
};
