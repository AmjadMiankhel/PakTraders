import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawTenderItem } from "../collection.types";
import { oneLine, parseFlexibleDate } from "../extraction/date-utils";
import { isDocumentUrl, parseAmountFromText, parseReferenceFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";
import { resolveUrl } from "./http-client";

export interface TableConnectorConfig {
  listingUrl?: string;
  tableSelector?: string;
  rowSelector?: string;
  columns?: Record<string, number | string>;
  titleSelector?: string;
  detailLinkSelector?: string;
  detailLinkPattern?: string;
  documentSelector?: string;
  defaultOrganization?: string;
  defaultCategory?: string;
  /** Replaces `{page}` in a path-based listing URL (e.g. /procurements/{page}). */
  pageUrlTemplate?: string;
  pagination?: { param: string; start?: number; max?: number } | null;
}

/**
 * Header synonyms used when a source does not spell out its column indexes.
 * This keeps the connector working across similar government tables without
 * hard-coding a layout that may change.
 */
const HEADER_HINTS: Record<string, string[]> = {
  title: ["title", "tender description", "description", "procurement title", "subject", "name of work"],
  referenceNumber: ["tender no", "tender number", "reference", "nit", "procurement no", "advertisement no"],
  organization: ["procuring agency", "organization", "organisation", "issuing authority"],
  department: ["department", "office", "entity"],
  publishedAt: ["publishing date", "published date", "advertisement date", "advertised date", "publication date"],
  closingAt: ["closing date", "deadline", "submission date", "closing"],
  openingAt: ["opening date", "opening"],
  city: ["city", "district"],
  province: ["province"],
  tenderType: ["type", "category", "procurement type", "tender type"],
  estimatedValue: ["estimated cost", "estimated value", "tender value", "cost"],
  bidSecurity: ["bid security", "earnest money", "emd"],
};

function configOf(ctx: ConnectorContext): TableConnectorConfig {
  return (ctx.source.config ?? {}) as TableConnectorConfig;
}

function headerTexts($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): string[] {
  return table
    .find("thead th, tr")
    .first()
    .find("th")
    .map((_index, element) => oneLine($(element).text()).toLowerCase())
    .get();
}

function scoreTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): number {
  const headers = headerTexts($, table);
  const wanted = ["title", "procurement title", "department", "closing date", "publishing date", "opening date", "tender document"];
  return wanted.reduce((score, header) => (headers.some((value) => value.includes(header)) ? score + 1 : score), 0);
}

function pickTable($: cheerio.CheerioAPI, selector: string | undefined): cheerio.Cheerio<any> {
  if (selector) {
    const selected = $(selector).first();
    if (selected.length > 0) return selected;
  }
  const tables = $("table").toArray().map((element) => $(element));
  if (tables.length === 0) {
    throw new ConnectorError("No table was found on the listing page. The layout may have changed.", {
      code: "LAYOUT_CHANGED",
    });
  }
  let best = tables[0] as cheerio.Cheerio<any>;
  let bestScore = -1;
  for (const table of tables) {
    const score = scoreTable($, table);
    if (score > bestScore) {
      best = table;
      bestScore = score;
    }
  }
  return best;
}

function cellFor(
  $: cheerio.CheerioAPI,
  cells: cheerio.Cheerio<any>,
  headers: string[],
  columns: Record<string, number | string> | undefined,
  key: string,
): cheerio.Cheerio<any> | null {
  const spec = columns?.[key];
  if (typeof spec === "number") return cells.eq(spec);
  if (typeof spec === "string") {
    const index = headers.findIndex((header) => header.includes(spec.toLowerCase()));
    if (index >= 0) return cells.eq(index);
  }
  // No explicit mapping: fall back to the header synonyms for this field.
  for (const hint of HEADER_HINTS[key] ?? []) {
    const index = headers.findIndex((header) => header.includes(hint));
    if (index >= 0) return cells.eq(index);
  }
  return null;
}

const GENERIC_DETAIL_HEADINGS = new Set([
  "tender details",
  "tender detail",
  "procurement details",
  "procurement detail",
  "details",
  "tender",
  "tenders",
  "procurement",
  "procurements",
  "home",
]);

/** Detail pages often start with a generic banner heading ("Tender Details"). */
function usableDetailHeading(text: string): boolean {
  const value = oneLine(text).toLowerCase().replace(/[:\s]+$/, "");
  if (value.length < 4) return false;
  if (GENERIC_DETAIL_HEADINGS.has(value)) return false;
  // A heading that only repeats a reference number is not a title.
  if (!/\s/.test(value) && /^[[\]a-z0-9/_.-]+$/.test(value)) return false;
  return true;
}

/** Picks the longest non-empty cell, used only when a title column is unknown. */
function longestCell(cells: cheerio.Cheerio<any>): cheerio.Cheerio<any> | null {
  let best: cheerio.Cheerio<any> | null = null;
  let bestLength = 0;
  cells.each((_index, element) => {
    const cell = cells.eq(_index);
    const text = oneLine(cell.text());
    if (!text || /^[\d\s.,/\\-]+$/.test(text)) return;
    if (text.length > bestLength) {
      bestLength = text.length;
      best = cell;
    }
  });
  return best;
}

function cellText(cell: cheerio.Cheerio<any> | null): string | undefined {
  if (!cell) return undefined;
  const value = oneLine(cell.text());
  return value || undefined;
}

function findDocumentUrls($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>, baseUrl: string, selector?: string): string[] {
  const links = selector ? row.find(selector) : row.find("a[href]");
  return links
    .map((_index, element) => {
      const href = $(element).attr("href");
      if (!href) return null;
      const resolved = resolveUrl(baseUrl, href);
      if (!resolved) return null;
      // A configured selector is trusted, but bare navigation links such as
      // "/downloads" are never documents even when the text says "download".
      return isDocumentUrl(resolved) ? resolved : null;
    })
    .get()
    .filter((value): value is string => Boolean(value));
}

function parseTableRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<any>,
  headers: string[],
  config: TableConnectorConfig,
  baseUrl: string,
): RawTenderItem | null {
  const cells = row.find("td");
  if (cells.length === 0) return null;

  const titleCell = cellFor($, cells, headers, config.columns, "title");
  const fallbackTitleCell = titleCell ?? longestCell(cells);
  const title = config.titleSelector
    ? oneLine(fallbackTitleCell?.find(config.titleSelector).first().text() ?? fallbackTitleCell?.text() ?? "")
    : cellText(fallbackTitleCell);
  if (!title || title.length < 4) return null;

  const linkSelector = config.detailLinkSelector;
  const linkElement = linkSelector ? row.find(linkSelector).first() : row.find("a[href]").first();
  const href = linkElement.attr("href");
  const documentUrls = findDocumentUrls($, row, baseUrl, config.documentSelector);
  const resolvedHref = href ? resolveUrl(baseUrl, href) : undefined;
  const isDocumentHref = Boolean(resolvedHref && isDocumentUrl(resolvedHref));
  const detailUrl = resolvedHref && !isDocumentHref ? resolvedHref : undefined;

  const reference = cellText(cellFor($, cells, headers, config.columns, "referenceNumber"));
  const rowText = oneLine(row.text());
  const externalId =
    (detailUrl ? new URL(detailUrl).pathname.split("/").filter(Boolean).pop() : undefined) ??
    parseReferenceFromText(reference ?? rowText) ??
    createHash("sha1").update(`${baseUrl}|${rowText}`).digest("hex").slice(0, 16);

  const publishedRaw = cellText(cellFor($, cells, headers, config.columns, "publishedAt"));
  const closingRaw = cellText(cellFor($, cells, headers, config.columns, "closingAt"));
  const openingRaw = cellText(cellFor($, cells, headers, config.columns, "openingAt"));
  const publishedAt = parseFlexibleDate(publishedRaw, { endOfDay: false });
  const closingAt = parseFlexibleDate(closingRaw, { endOfDay: true });
  const openingAt = parseFlexibleDate(openingRaw, { endOfDay: false });

  const organization = cellText(cellFor($, cells, headers, config.columns, "organization")) ?? config.defaultOrganization;
  const department = cellText(cellFor($, cells, headers, config.columns, "department"));
  const category = cellText(cellFor($, cells, headers, config.columns, "category")) ?? config.defaultCategory;
  const city = cellText(cellFor($, cells, headers, config.columns, "city"));
  const province = cellText(cellFor($, cells, headers, config.columns, "province"));
  const tenderType = cellText(cellFor($, cells, headers, config.columns, "tenderType"));
  const estimatedValue = parseAmountFromText(cellText(cellFor($, cells, headers, config.columns, "estimatedValue")));
  const bidSecurity = parseAmountFromText(cellText(cellFor($, cells, headers, config.columns, "bidSecurity")));

  const fieldConfidence: Record<string, number> = { title: 0.9 };
  if (publishedAt) fieldConfidence.publishedAt = 0.9;
  if (closingAt) fieldConfidence.closingAt = 0.9;
  if (openingAt) fieldConfidence.openingAt = 0.85;
  if (organization) fieldConfidence.organization = 0.9;
  if (department) fieldConfidence.department = 0.85;
  if (city) fieldConfidence.citySlug = 0.8;
  if (province) fieldConfidence.provinceSlug = 0.8;
  if (reference) fieldConfidence.referenceNumber = 0.85;

  return {
    externalId,
    sourceUrl: detailUrl ?? documentUrls[0] ?? baseUrl,
    title,
    referenceNumber: reference ?? parseReferenceFromText(rowText) ?? undefined,
    organization,
    department,
    category,
    city,
    province,
    tenderType,
    publishedAt: publishedAt?.toISOString(),
    closingAt: closingAt?.toISOString(),
    openingAt: openingAt?.toISOString(),
    estimatedValue: estimatedValue ?? undefined,
    bidSecurity: bidSecurity ?? undefined,
    documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
    fieldConfidence,
    raw: {
      rowText,
      cells: cells.map((_index, element) => oneLine($(element).text())).get(),
      headers,
      detailUrl: detailUrl ?? null,
    },
  };
}

function listingUrlFor(ctx: ConnectorContext, config: TableConnectorConfig): string {
  return String(config.listingUrl ?? ctx.source.url ?? ctx.source.baseUrl ?? "");
}

/** Generic connector for official HTML tables (KPPRA, AJK PPRA, GB PPRA). */
export const tableConnector: SourceConnector = {
  key: "table",
  label: "Official HTML tender table",
  supportsEnrichment: true,

  async collect(ctx: ConnectorContext) {
    const config = configOf(ctx);
    const listing = listingUrlFor(ctx, config);
    if (!listing) throw new ConnectorError("This source has no listing URL configured.", { code: "MISSING_CONFIG", retryable: false });

    const items = new Map<string, RawTenderItem>();
    const notes: string[] = [];
    let pagesFetched = 0;
    const pagination = config.pagination;
    const template = config.pageUrlTemplate;
    const start = pagination?.start ?? 1;
    const max = Math.min(
      pagination?.max ?? (template ? ctx.source.maxPages : 1),
      ctx.source.maxPages,
      20,
    );

    for (let page = start; page < start + max; page += 1) {
      const url = template
        ? template.replace("{page}", String(page))
        : (() => {
            const next = new URL(listing);
            if (pagination?.param) next.searchParams.set(pagination.param, String(page));
            return next;
          })();
      const { text } = await ctx.http.getText(url.toString());
      pagesFetched += 1;
      const $ = cheerio.load(text);
      const table = pickTable($, config.tableSelector);
      const headers = headerTexts($, table);
      const rowSelector = config.rowSelector ?? "tr";
      const rows = table.find(rowSelector);
      if (rows.length === 0) {
        if (pagesFetched === 1) {
          throw new ConnectorError("The configured tender table has no rows. The layout may have changed.", {
            code: "LAYOUT_CHANGED",
          });
        }
        break;
      }
      rows.each((_index, row) => {
        const parsed = parseTableRow($, $(row), headers, config, url.toString());
        if (!parsed?.externalId) return;
        if (!items.has(parsed.externalId)) items.set(parsed.externalId, parsed);
      });
      if (!pagination && !template) break;
      if (items.size >= ctx.maxItems) break;
    }

    if (items.size === 0) notes.push("No tender rows were parsed from the listing.");
    return { items: Array.from(items.values()).slice(0, ctx.maxItems), pagesFetched, notes };
  },

  async enrich(ctx: ConnectorContext, item: RawTenderItem): Promise<RawTenderItem> {
    if (item.sourceUrl === listingUrlFor(ctx, configOf(ctx))) return item;
    // When a row has no detail page the first document is used as the source
    // URL. Never try to parse a PDF or download endpoint as an HTML page.
    if (isDocumentUrl(item.sourceUrl)) return item;
    const { text } = await ctx.http.getText(item.sourceUrl);
    const $ = cheerio.load(text);
    const pairs: Record<string, string> = {};

    $(".detail-label").each((_index, element) => {
      const label = oneLine($(element).text()).replace(/:$/, "").toLowerCase();
      const clone = $(element).parent().clone();
      clone.find(".detail-label").remove();
      const value = oneLine(clone.text());
      if (label && value) pairs[label] = value;
    });
    $("dt").each((_index, element) => {
      const label = oneLine($(element).text()).replace(/:$/, "").toLowerCase();
      const value = oneLine($(element).next("dd").text());
      if (label && value) pairs[label] = value;
    });
    $("tr").each((_index, element) => {
      const label = oneLine($(element).find("th").first().text()).replace(/:$/, "").toLowerCase();
      const value = oneLine($(element).find("td").first().text());
      if (label && value && label.length < 80) pairs[label] = value;
    });

    const findPair = (keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = pairs[key];
        if (value) return value;
      }
      return undefined;
    };

    const documentUrls = $("a[href]")
      .map((_index, element) => {
        const href = $(element).attr("href");
        if (!href) return null;
        const resolved = resolveUrl(item.sourceUrl, href);
        if (!resolved || !isDocumentUrl(resolved)) return null;
        return resolved;
      })
      .get()
      .filter((value): value is string => Boolean(value));

    const detailTitle = findPair([
      "procurment title",
      "procurement title",
      "tender title",
      "name of work",
      "subject",
    ]);
    const headingTitle = $("h1, h2, .page-title, .card-title")
      .toArray()
      .map((element) => oneLine($(element).text()))
      .find(usableDetailHeading);
    const publishedAt = parseFlexibleDate(
      findPair([
        "publishing date",
        "published date",
        "publish date",
        "advertisement date",
        "advertised date",
        "publication date",
      ]),
      { endOfDay: false },
    );
    const closingAt = parseFlexibleDate(
      findPair(["closing date & time", "closing date and time", "closing date", "deadline"]),
      { endOfDay: true },
    );
    const openingAt = parseFlexibleDate(
      findPair(["opening date & time", "opening date and time", "opening date"]),
      { endOfDay: false },
    );
    const organization = findPair(["procuring agency", "organization name", "organisation name", "department"]);
    const city = findPair(["city", "district"]);
    const reference = findPair([
      "search engine #",
      "search engine no",
      "tender no",
      "reference no",
      "tender reference",
      "nit no",
    ]);
    const tenderType = findPair(["procurment type", "procurement type", "tender type"]);
    const estimatedValue = parseAmountFromText(findPair(["estimated cost", "estimated value", "tender value"]));
    const bidSecurity = parseAmountFromText(findPair(["earnest money", "bid security", "emd"]));
    const contactEmail = findPair(["contact email", "email"]);
    const contactPhone = findPair(["contact phone", "phone", "telephone"]);
    const contactPerson = findPair(["contact person", "contact name"]);
    const contactAddress = findPair(["address", "office address"]);
    const eligibility = findPair(["eligibility", "eligibility criteria", "qualification criteria"]);
    const description = findPair([
      "procurment description",
      "procurement description",
      "description",
      "tender description",
      "scope of work",
    ]);

    const confidence = { ...(item.fieldConfidence ?? {}) };
    if (publishedAt) confidence.publishedAt = 0.9;
    if (closingAt) confidence.closingAt = 0.9;
    if (openingAt) confidence.openingAt = 0.85;
    if (organization) confidence.organization = 0.9;
    if (reference) confidence.referenceNumber = 0.9;
    if (estimatedValue) confidence.estimatedValue = 0.85;
    if (bidSecurity) confidence.bidSecurityAmount = 0.85;

    return {
      ...item,
      title: detailTitle || headingTitle || item.title,
      referenceNumber: reference || item.referenceNumber,
      organization: organization || item.organization,
      tenderType: tenderType || item.tenderType,
      city: city || item.city,
      publishedAt: publishedAt?.toISOString() ?? item.publishedAt,
      closingAt: closingAt?.toISOString() ?? item.closingAt,
      openingAt: openingAt?.toISOString() ?? item.openingAt,
      estimatedValue: estimatedValue ?? item.estimatedValue,
      bidSecurity: bidSecurity ?? item.bidSecurity,
      eligibility: eligibility || item.eligibility,
      description: description || item.description,
      contactName: contactPerson,
      contactEmail,
      contactPhone,
      contactAddress,
      documentUrls: documentUrls.length > 0 ? documentUrls : item.documentUrls,
      fieldConfidence: confidence,
      raw: { ...(item.raw ?? {}), detailPairs: pairs },
    };
  },
};
