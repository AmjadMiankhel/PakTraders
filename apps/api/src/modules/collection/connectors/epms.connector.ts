import * as cheerio from "cheerio";
import type { RawTenderItem } from "../collection.types";
import { oneLine, parseFlexibleDate } from "../extraction/date-utils";
import { parseAmountFromText, parseReferenceFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";
import { resolveUrl } from "./http-client";

const DEFAULT_LISTING = "https://epms.ppra.gov.pk/public/tenders/active-tenders";

function pageUrl(base: string, page: number): string {
  const url = new URL(base);
  url.searchParams.set("page", String(page));
  return url.toString();
}

function labelPairs($: cheerio.CheerioAPI): Record<string, string> {
  const pairs: Record<string, string> = {};
  $(".detail-label").each((_index, element) => {
    const label = oneLine($(element).text()).replace(/:$/, "").toLowerCase();
    const parent = $(element).parent();
    const clone = parent.clone();
    clone.find(".detail-label").remove();
    const value = oneLine(clone.text());
    if (label && value) pairs[label] = value;
  });
  return pairs;
}

function pick(pairs: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = pairs[key];
    if (value) return value;
  }
  return undefined;
}

/**
 * PPRA EPMS public tender listing. Only the public pages linked from
 * ppra.org.pk are read; no login, CAPTCHA or restricted endpoint is used.
 */
export const epmsConnector: SourceConnector = {
  key: "epms",
  label: "PPRA EPMS public tender listing",
  supportsEnrichment: true,

  async collect(ctx: ConnectorContext) {
    const listing = ctx.source.config.listingUrl
      ? String(ctx.source.config.listingUrl)
      : ctx.source.url || DEFAULT_LISTING;
    const maxPages = Math.max(1, Math.min(ctx.source.maxPages, 10));
    const items = new Map<string, RawTenderItem>();
    const notes: string[] = [];
    let pagesFetched = 0;

    for (let page = 1; page <= maxPages; page += 1) {
      const url = pageUrl(listing, page);
      const { text, response } = await ctx.http.getText(url);
      pagesFetched += 1;
      if (response.finalUrl !== url) notes.push(`Listing redirected to ${response.finalUrl}`);
      const $ = cheerio.load(text);
      const rows = $("table.cb-rt tbody tr");
      if (rows.length === 0) {
        if (page === 1) {
          throw new ConnectorError("EPMS listing table was not found. The page layout may have changed.", {
            code: "LAYOUT_CHANGED",
          });
        }
        break;
      }

      rows.each((_index, row) => {
        const $row = $(row);
        const link = $row.find('a[href*="/public/tenders/tender-details/"]').first().attr("href");
        if (!link) return;
        const sourceUrl = resolveUrl(listing, link);
        const externalId = link.split("/").filter(Boolean).pop() ?? sourceUrl;
        if (items.has(externalId)) return;

        const tenderNo = oneLine($row.find('td[data-label="Tender No"] strong').first().text()) ||
          oneLine($row.find(".cb-rt-name").first().text());
        const title = oneLine($row.find('td[data-label="Tender Details"] strong').first().text());
        if (!title) return;
        const status = oneLine($row.find('td[data-label="Status"]').text());
        const advertised = oneLine($row.find('td[data-label="Advertised"]').text());
        const closingText = oneLine($row.find('td[data-label="Closing"]').text());
        const badges = $row
          .find("small.badge")
          .map((_i, el) => oneLine($(el).text()))
          .get()
          .filter(Boolean);
        const reference =
          parseReferenceFromText(badges.join(" ")) ??
          badges.find((value) => /^[A-Z0-9][A-Z0-9/_.-]{3,40}$/i.test(value) && value !== tenderNo) ??
          tenderNo;

        const publishedAt = parseFlexibleDate(advertised, { endOfDay: false });
        const closingAt = parseFlexibleDate(closingText, { endOfDay: true });

        const item: RawTenderItem = {
          externalId,
          sourceUrl,
          title,
          referenceNumber: reference || undefined,
          category: badges[0],
          publishedAt: publishedAt?.toISOString(),
          closingAt: closingAt?.toISOString(),
          fieldConfidence: {
            title: 0.95,
            referenceNumber: reference ? 0.9 : undefined,
            publishedAt: publishedAt ? 0.9 : undefined,
            closingAt: closingAt ? 0.9 : undefined,
            category: badges[0] ? 0.7 : undefined,
          },
          raw: {
            tenderNo,
            status,
            advertised,
            closing: closingText,
            badges,
            listingPage: page,
          },
        };
        items.set(externalId, item);
      });

      if (items.size >= ctx.maxItems) break;
    }

    return {
      items: Array.from(items.values()).slice(0, ctx.maxItems),
      pagesFetched,
      notes,
    };
  },

  async enrich(ctx: ConnectorContext, item: RawTenderItem): Promise<RawTenderItem> {
    const { text } = await ctx.http.getText(item.sourceUrl);
    const $ = cheerio.load(text);
    const pairs = labelPairs($);
    if (Object.keys(pairs).length === 0) return item;

    const pageTitle = oneLine($("title").first().text()).replace(/\s*-\s*PPRA\s*$/i, "");
    const organization = pick(pairs, ["organization name", "organisation name"]);
    const office = pick(pairs, ["office name"]);
    const city = pick(pairs, ["city"]);
    const contactPerson = pick(pairs, ["contact person"]);
    const contactEmail = pick(pairs, ["contact email", "email"]);
    const contactPhone = pick(pairs, ["contact phone", "phone"]);
    const contactAddress = pick(pairs, ["office address", "address"]);
    const reference = pick(pairs, [
      "tender no / reference no / tender inquiry no",
      "tender no",
      "reference no",
      "tender inquiry no",
    ]);
    const tenderType = pick(pairs, ["tender type"]);
    const procurementCategory = pick(pairs, ["procurement category", "sector"]);
    const advertisementDate = pick(pairs, ["advertisement date", "advertised date"]);
    const closingDateTime = pick(pairs, ["closing date & time", "closing date and time", "closing date"]);
    const openingDateTime = pick(pairs, ["opening date & time", "opening date and time", "opening date"]);
    const estimatedCost = pick(pairs, ["estimated cost", "estimated value"]);
    const earnestMoney = pick(pairs, ["earnest money", "bid security"]);
    const bidValidity = pick(pairs, ["bid validity"]);

    const documentUrls = $("a")
      .map((_index, element) => {
        const label = oneLine($(element).text()).toLowerCase();
        const href = $(element).attr("href");
        if (!href) return null;
        if (!/download (tender document|advertisement|document)|tender document|advertisement/.test(label)) return null;
        return resolveUrl(item.sourceUrl, href);
      })
      .get()
      .filter((value): value is string => Boolean(value));

    const publishedAt = parseFlexibleDate(advertisementDate, { endOfDay: false });
    const closingAt = parseFlexibleDate(closingDateTime, { endOfDay: true });
    const openingAt = parseFlexibleDate(openingDateTime, { endOfDay: false });
    const estimatedValue = parseAmountFromText(estimatedCost);
    const bidSecurity = parseAmountFromText(earnestMoney);

    const confidence = { ...(item.fieldConfidence ?? {}) };
    if (reference) confidence.referenceNumber = 0.95;
    if (publishedAt) confidence.publishedAt = 0.95;
    if (closingAt) confidence.closingAt = 0.95;
    if (organization) confidence.organization = 0.95;
    if (city) confidence.citySlug = 0.9;
    if (estimatedValue) confidence.estimatedValue = 0.9;
    if (bidSecurity) confidence.bidSecurityAmount = 0.9;
    if (contactEmail) confidence.contactEmail = 0.95;
    if (contactPhone) confidence.contactPhone = 0.9;

    return {
      ...item,
      title: pageTitle || item.title,
      referenceNumber: reference || item.referenceNumber,
      organization: organization || item.organization,
      department: office || item.department,
      city: city || item.city,
      category: procurementCategory || item.category,
      publishedAt: publishedAt?.toISOString() ?? item.publishedAt,
      closingAt: closingAt?.toISOString() ?? item.closingAt,
      openingAt: openingAt?.toISOString() ?? item.openingAt,
      estimatedValue: estimatedValue ?? item.estimatedValue,
      bidSecurity: bidSecurity ?? item.bidSecurity,
      contactName: contactPerson,
      contactEmail,
      contactPhone,
      contactAddress,
      documentUrls: documentUrls.length > 0 ? documentUrls : item.documentUrls,
      fieldConfidence: confidence,
      raw: {
        ...(item.raw ?? {}),
        detailPairs: pairs,
        tenderType,
        bidValidity,
        openingTime: pick(pairs, ["opening time"]),
        procurementProcedure: pick(pairs, ["procurement procedure"]),
        tenderNature: pick(pairs, ["tender nature"]),
      },
    };
  },
};
