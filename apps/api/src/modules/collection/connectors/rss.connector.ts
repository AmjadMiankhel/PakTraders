import { XMLParser } from "fast-xml-parser";
import type { RawTenderItem } from "../collection.types";
import { cleanText, oneLine, parseFlexibleDate } from "../extraction/date-utils";
import { parseReferenceFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  cdataPropName: "#cdata",
});

const PDF_PATTERN = /https?:\/\/[^\s"'<>]+?\.pdf(?:\?[^\s"'<>]*)?/gi;

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Reads text from RSS/Atom nodes, including attribute-only links. */
function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["#text", "#cdata", "@_href", "@_url", "@_term"]) {
      if (record[key] !== undefined) {
        const text = textOf(record[key]);
        if (text) return text;
      }
    }
  }
  return "";
}

function stripMarkup(value: string): string {
  return cleanText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

function extractFeedItems(parsed: Record<string, unknown>): unknown[] {
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel && channel.item) return asArray(channel.item);

  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed && feed.entry) return asArray(feed.entry);

  const rdf = parsed["rdf:RDF"] as Record<string, unknown> | undefined;
  if (rdf && rdf.item) return asArray(rdf.item);

  return [];
}

function linkOf(record: Record<string, unknown>): string {
  const raw = record.link ?? record.guid ?? record.id;
  const candidates = asArray(raw);
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const entry = candidate as Record<string, unknown>;
      const rel = textOf(entry["@_rel"]);
      const href = textOf(entry["@_href"]) || textOf(entry["@_url"]) || textOf(entry["#text"]);
      if (href && /^https?:\/\//i.test(href) && (!rel || rel === "alternate")) return href;
    }
  }
  const guid = textOf(record.guid);
  if (/^https?:\/\//i.test(guid)) return guid;
  return "";
}

function dateOf(record: Record<string, unknown>): string | undefined {
  for (const key of ["pubDate", "published", "updated", "dc:date", "date"]) {
    const value = textOf(record[key]);
    if (!value) continue;
    const parsed = parseFlexibleDate(value, { endOfDay: false });
    if (parsed) return parsed.toISOString();
  }
  return undefined;
}

/**
 * Standard RSS 2.0 / Atom feed connector for sources that publish an
 * authorised feed. Only the feed URL is fetched; article pages are not
 * crawled unless a detail link is the same feed URL.
 */
export const rssConnector: SourceConnector = {
  key: "rss",
  label: "RSS / Atom feed",
  supportsEnrichment: false,

  async collect(ctx: ConnectorContext) {
    const feedUrl = String(ctx.source.config.feedUrl ?? ctx.source.url ?? ctx.source.baseUrl ?? "");
    if (!feedUrl) {
      throw new ConnectorError("This RSS source has no feed URL configured.", {
        code: "MISSING_CONFIG",
        retryable: false,
      });
    }

    const { text, response } = await ctx.http.getText(feedUrl, {
      accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
    });
    let parsed: Record<string, unknown>;
    try {
      parsed = parser.parse(text) as Record<string, unknown>;
    } catch (error) {
      throw new ConnectorError(
        `Feed could not be parsed as XML: ${error instanceof Error ? error.message : String(error)}`,
        { code: "INVALID_FEED", retryable: false },
      );
    }

    const entries = extractFeedItems(parsed);
    if (entries.length === 0) {
      throw new ConnectorError("The feed contained no RSS items or Atom entries.", {
        code: "EMPTY_FEED",
        retryable: false,
      });
    }

    const items: RawTenderItem[] = [];
    const notes: string[] = [];
    for (const entry of entries.slice(0, ctx.maxItems)) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const title = oneLine(textOf(record.title));
      if (!title) continue;
      const link = linkOf(record) || feedUrl;
      const body = stripMarkup(
        [textOf(record.description), textOf(record["content:encoded"]), textOf(record.summary), textOf(record.content)]
          .filter(Boolean)
          .join("\n"),
      );
      const documentUrls = Array.from(new Set(body.match(PDF_PATTERN) ?? []));
      const reference = parseReferenceFromText(`${title} ${body}`);
      const externalId =
        textOf(record.guid) || textOf(record.id) || link || `${response.finalUrl}#${title.slice(0, 60)}`;

      items.push({
        externalId,
        sourceUrl: link,
        title,
        referenceNumber: reference ?? undefined,
        description: body || undefined,
        publishedAt: dateOf(record),
        documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
        fieldConfidence: { title: 0.9, description: body ? 0.75 : undefined },
        raw: { feedUrl, entry: record },
      });
    }

    if (items.length === 0) notes.push("Feed entries were present but none contained a usable title.");
    return { items, pagesFetched: 1, notes };
  },
};
