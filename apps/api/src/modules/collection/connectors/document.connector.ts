import * as cheerio from "cheerio";
import type { RawTenderItem } from "../collection.types";
import { oneLine } from "../extraction/date-utils";
import { parseReferenceFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";
import { resolveUrl } from "./http-client";

export interface DocumentConnectorConfig {
  listingUrl?: string;
  documentUrls?: string[];
  linkSelector?: string;
  documentPattern?: string;
  titleSelector?: string;
  maxDocuments?: number;
}

const DEFAULT_PATTERN = "\\.pdf(?:$|\\?)|/download|force_download|attachment";

function fileNameOf(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
    return name || url;
  } catch {
    return url;
  }
}

function titleFromFileName(url: string): string {
  const name = fileNameOf(url)
    .replace(/\.(pdf|docx?|xlsx?|jpe?g|png|tiff?)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 4 ? name : fileNameOf(url);
}

/**
 * Document monitor for sources that publish advertisements as PDFs/images
 * without a structured listing. Only documents linked from the configured
 * public page (or explicitly listed) are fetched; OCR runs in the processor.
 */
export const documentConnector: SourceConnector = {
  key: "document",
  label: "Published PDF/image monitor",
  supportsEnrichment: false,

  async collect(ctx: ConnectorContext) {
    const config = (ctx.source.config ?? {}) as DocumentConnectorConfig;
    const listingUrl = String(config.listingUrl ?? ctx.source.url ?? ctx.source.baseUrl ?? "");
    const explicit = Array.isArray(config.documentUrls) ? config.documentUrls.filter(Boolean) : [];
    const max = Math.min(config.maxDocuments ?? ctx.maxItems, ctx.maxItems);

    if (explicit.length === 0 && !listingUrl) {
      throw new ConnectorError("This document source has neither a listing URL nor document URLs.", {
        code: "MISSING_CONFIG",
        retryable: false,
      });
    }

    const links = new Map<string, { url: string; title: string }>();
    for (const url of explicit) links.set(url, { url, title: titleFromFileName(url) });

    let pagesFetched = 0;
    if (listingUrl) {
      const { text } = await ctx.http.getText(listingUrl);
      pagesFetched = 1;
      const $ = cheerio.load(text);
      const pattern = new RegExp(config.documentPattern ?? DEFAULT_PATTERN, "i");
      const selector = config.linkSelector ?? "a[href]";
      $(selector).each((_index, element) => {
        const href = $(element).attr("href");
        if (!href) return;
        const url = resolveUrl(listingUrl, href);
        if (!/^https?:\/\//i.test(url) || !pattern.test(url)) return;
        if (links.has(url)) return;
        const linkText = oneLine(
          config.titleSelector ? $(element).find(config.titleSelector).first().text() : $(element).text(),
        );
        const titleAttr = oneLine($(element).attr("title") ?? "");
        const title = linkText.length >= 6 ? linkText : titleAttr.length >= 6 ? titleAttr : titleFromFileName(url);
        links.set(url, { url, title });
      });
    }

    if (links.size === 0) {
      throw new ConnectorError("No permitted documents were found at the configured location.", {
        code: "NO_DOCUMENTS",
        retryable: false,
      });
    }

    const items: RawTenderItem[] = Array.from(links.values())
      .slice(0, max)
      .map((entry) => ({
        externalId: fileNameOf(entry.url),
        sourceUrl: entry.url,
        title: entry.title,
        referenceNumber: parseReferenceFromText(entry.title) ?? undefined,
        documentUrls: [entry.url],
        fieldConfidence: { title: 0.55 },
        raw: { listingUrl: listingUrl || null, documentUrl: entry.url },
      }));

    return {
      items,
      pagesFetched,
      notes: ["Titles come from link text or file names and are flagged for review until the document text confirms them."],
    };
  },
};
