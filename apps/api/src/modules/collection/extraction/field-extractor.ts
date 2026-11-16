import { cleanText, oneLine, parseFlexibleDate, parseTime } from "./date-utils";
import { parseReferenceFromText } from "./parse-helpers";

export interface LocationEntry {
  name: string;
  slug: string;
  provinceSlug?: string;
}

export interface ExtractContext {
  sourceName: string;
  sourceCategory: string;
  defaultProvinceSlug: string | null;
  cities: LocationEntry[];
  provinces: LocationEntry[];
}

export interface ExtractedFields {
  title?: string;
  referenceNumber?: string;
  organization?: string;
  categorySlug?: string;
  provinceSlug?: string;
  citySlug?: string;
  tenderType?: "GOVERNMENT" | "PRIVATE" | "NGO" | "AUCTION" | "CONSULTANCY" | "NEWSPAPER";
  publishedAt?: Date;
  closingAt?: Date;
  openingAt?: Date;
  estimatedValue?: string;
  bidSecurityAmount?: string;
  eligibility?: string;
  requiredDocuments?: string[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  confidence: Record<string, number>;
  warnings: string[];
}

const CATEGORY_RULES: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "construction-civil-engineering", patterns: [/\b(construction|civil works?|roads?|bridges?|building|renovation|repair of building|grey structure|culvert|drainage works?|boundary wall)\b/i] },
  { slug: "electrical-electronics", patterns: [/\b(electrical|electric works?|wiring|transformer|generator|switchgear|ups|solar inverter|electronics?)\b/i] },
  { slug: "it-technology", patterns: [/\b(information technology|software|computer|computers|laptop|servers?|networking|network equipment|website|web portal|database|cyber|data centre|data center|hardware)\b/i] },
  { slug: "medical-healthcare", patterns: [/\b(medical|medicine|medicines|surgical|hospital|health|vaccine|laboratory|lab equipment|ambulance|nursing|dental)\b/i] },
  { slug: "office-supplies-stationery", patterns: [/\b(stationery|office supplies|furniture|toner|paper ream|files? and folders?|office equipment)\b/i] },
  { slug: "printing-publishing", patterns: [/\b(printing|publishing|publication|brochure|book binding|advertisement printing)\b/i] },
  { slug: "transportation-logistics", patterns: [/\b(transport|transportation|vehicles?|buses?|trucks?|pickup|logistics|freight|fuel|diesel|petrol|tyres?|spare parts?)\b/i] },
  { slug: "water-environment", patterns: [/\b(water supply|water scheme|sewerage|sewer|drainage|tube well|filtration|environment|waste water|solid waste)\b/i] },
  { slug: "solar-renewable-energy", patterns: [/\b(solar|renewable energy|photovoltaic|wind energy|net metering)\b/i] },
  { slug: "telecommunications", patterns: [/\b(telecom|telecommunication|mobile service|sim|internet service|bandwidth|fibre|fiber optic|ptcl)\b/i] },
  { slug: "security-safety", patterns: [/\b(security guards?|security services|cctv|surveillance|fire fighting|fire safety|safety equipment)\b/i] },
  { slug: "food-catering", patterns: [/\b(food|foodstuff|catering|kitchen|meals?|refreshment|ration)\b/i] },
  { slug: "education-training", patterns: [/\b(education|training|school|college|university|students?|teaching|curriculum|scholarship)\b/i] },
  { slug: "consultancy-professional-services", patterns: [/\b(consultancy|consultant|consulting|advisory|feasibility|design services|architect|legal services|audit services|third party validation)\b/i] },
  { slug: "insurance-financial-services", patterns: [/\b(insurance|banking|financial services|actuarial|investment advisory)\b/i] },
  { slug: "agriculture-livestock", patterns: [/\b(agriculture|agricultural|livestock|seeds?|fertilizer|pesticide|irrigation|tractor|veterinary|fisheries|forestry)\b/i] },
  { slug: "auctions-disposal", patterns: [/\b(auction|disposal|scrap|condemned|obsolete items|surplus items|e-auction)\b/i] },
  { slug: "cleaning-maintenance", patterns: [/\b(cleaning|janitorial|housekeeping|maintenance services|upkeep|sanitation services)\b/i] },
  { slug: "textile-clothing", patterns: [/\b(textile|clothing|uniforms?|garments?|stitching|fabric|bed linen)\b/i] },
  { slug: "real-estate-property", patterns: [/\b(real estate|property|rent of|rental|lease of|land acquisition|building lease|office accommodation)\b/i] },
  { slug: "mechanical-industrial-equipment", patterns: [/\b(machinery|mechanical|industrial equipment|pumps?|compressors?|boiler|turbine|workshop equipment|plant and machinery)\b/i] },
  { slug: "ngo-development-projects", patterns: [/\b(ngo|non[- ]governmental|development project|community development|social welfare|grant|donor funded)\b/i] },
];

const TENDER_TYPE_RULES: Array<{ type: ExtractedFields["tenderType"]; patterns: RegExp[] }> = [
  { type: "AUCTION", patterns: [/\b(auction|disposal|e-auction|sale of scrap)\b/i] },
  { type: "CONSULTANCY", patterns: [/\b(consultancy|consultant|expression of interest|eoi|request for proposal|rfp|feasibility study|advisory services)\b/i] },
  { type: "NGO", patterns: [/\b(ngo|non[- ]governmental|donor|grant)\b/i] },
  { type: "PRIVATE", patterns: [/\b(private limited|pvt\.? ltd|private sector)\b/i] },
];

function stripLabel(value: string): string {
  return oneLine(value)
    .replace(/^[\s:–—-]+/, "")
    .replace(/[\s:–—-]+$/, "")
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = match?.[1] ?? match?.[0];
    if (value && stripLabel(value).length > 1) return stripLabel(value);
  }
  return null;
}

/**
 * Cuts a captured value at the next "Label:" so a field published on the same
 * line as the following field cannot swallow the rest of the notice.
 */
function trimAtNextLabel(value: string): string {
  const stop =
    /\s+(?:published|publish(?:ing)? date|closing|opening|bid security|earnest money|estimated|eligibility|required documents?|contact|e-?mail|phone|telephone|fax|address|website|tender (?:no|number|type)|reference|department|organization|organisation|procuring agency|office name|issuing authority)\s*[:\-]/i.exec(
      value,
    );
  return (stop ? value.slice(0, stop.index) : value).trim();
}

function parseAmount(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = oneLine(raw).toLowerCase().replace(/,/g, "");
  const match = /(\d+(?:\.\d+)?)\s*(crore|karor|kharab|lakh|lac|million|billion|mn|bn)?/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2] ?? "";
  const multiplier =
    unit === "crore" || unit === "karor"
      ? 10_000_000
      : unit === "kharab"
        ? 100_000_000_000
        : unit === "lakh" || unit === "lac"
          ? 100_000
          : unit === "million" || unit === "mn"
            ? 1_000_000
            : unit === "billion" || unit === "bn"
              ? 1_000_000_000
              : 1;
  return (value * multiplier).toFixed(2);
}

function findLocation(
  text: string,
  entries: LocationEntry[],
): LocationEntry | null {
  const haystack = ` ${text.toLowerCase()} `;
  let best: LocationEntry | null = null;
  for (const entry of entries) {
    const needle = entry.name.toLowerCase();
    if (needle.length < 3) continue;
    if (!haystack.includes(needle)) continue;
    if (!best || needle.length > best.name.length) best = entry;
  }
  return best;
}

function extractSection(text: string, headings: RegExp[], maxLength: number): string | null {
  for (const heading of headings) {
    const match = heading.exec(text);
    if (!match) continue;
    const start = (match.index ?? 0) + match[0].length;
    const section = text.slice(start, start + maxLength);
    if (!section.trim()) continue;

    if (/^\r?\n/.test(section)) {
      // The heading sits on its own line, so the section continues over the
      // following lines until a blank line or the next labelled field.
      const body = section.replace(/^\n+/, "");
      const stop =
        /\n\s*\n|\n\s*(?:eligibility|required documents?|documents required|instructions|submission|contact|address|terms|conditions|bid security|estimated|tender details)\b/i.exec(
          body,
        );
      const value = oneLine(stop ? body.slice(0, stop.index) : body);
      if (value.length >= 8) return value.slice(0, maxLength);
    } else {
      // The value is published inline ("Eligibility: ..."), so it ends at the
      // end of that line.
      const lineEnd = section.indexOf("\n");
      const value = oneLine(lineEnd === -1 ? section : section.slice(0, lineEnd));
      if (value.length >= 8) return value.slice(0, maxLength);
    }
  }
  return null;
}

/**
 * Deterministic field extraction. Every value comes from the supplied text;
 * nothing is inferred when the source did not publish it. Confidence values
 * reflect how directly the value appeared in the source.
 */
export function extractFields(rawText: string, ctx: ExtractContext): ExtractedFields {
  const text = cleanText(rawText);
  const flat = oneLine(text);
  const confidence: Record<string, number> = {};
  const warnings: string[] = [];
  const result: ExtractedFields = { confidence, warnings };

  if (!flat) {
    warnings.push("No text was available for extraction.");
    return result;
  }

  const ref = parseReferenceFromText(flat);
  if (ref) {
    result.referenceNumber = ref;
    confidence.referenceNumber = 0.9;
  }

  const publishedRaw = firstMatch(flat, [
    /(?:advertisement|advertised|published|publish(?:ing)? date|date of publication)\s*(?:date)?\s*[:\-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
  ]);
  if (publishedRaw) {
    const parsed = parseFlexibleDate(publishedRaw, { endOfDay: false });
    if (parsed) {
      result.publishedAt = parsed;
      confidence.publishedAt = 0.85;
    }
  }

  const closingRaw = firstMatch(flat, [
    /(?:closing|close|bid submission|submission deadline|last date|deadline)\s*(?:date|time)?\s*(?:&|and)?\s*(?:time)?\s*[:\-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4}(?:\s*(?:at|,)?\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s*(?:at|,)?\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s*(?:at|,)?\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?)/i,
  ]);
  if (closingRaw) {
    const parsed = parseFlexibleDate(closingRaw, { endOfDay: true });
    if (parsed) {
      result.closingAt = parsed;
      confidence.closingAt = parseTime(closingRaw) ? 0.9 : 0.7;
      if (!parseTime(closingRaw)) {
        warnings.push("Closing time was not published; the closing date is treated as end of day (PKT).");
      }
    }
  }

  const openingRaw = firstMatch(flat, [
    /(?:opening|bid opening)\s*(?:date|time)?\s*(?:&|and)?\s*(?:time)?\s*[:\-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4}(?:\s*(?:at|,)?\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s*(?:at|,)?\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s*(?:at|,)?\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?)/i,
  ]);
  if (openingRaw) {
    const parsed = parseFlexibleDate(openingRaw, { endOfDay: false });
    if (parsed) {
      result.openingAt = parsed;
      confidence.openingAt = 0.85;
    }
  }

  const estimatedRaw = firstMatch(flat, [
    /(?:estimated (?:cost|value|amount)|estimate|tender value|total cost)\s*[:\-]?\s*(?:rs\.?|pkr|₨)?\s*([0-9][0-9,]*(?:\.\d+)?\s*(?:crore|karor|lakh|lac|million|billion)?)/i,
  ]);
  const estimated = parseAmount(estimatedRaw);
  if (estimated) {
    result.estimatedValue = estimated;
    confidence.estimatedValue = 0.85;
  }

  const securityRaw = firstMatch(flat, [
    /(?:earnest money|bid security|emd|security deposit|bid bond)\s*[:\-]?\s*(?:rs\.?|pkr|₨)?\s*([0-9][0-9,]*(?:\.\d+)?\s*(?:crore|karor|lakh|lac|million|billion)?)/i,
  ]);
  const security = parseAmount(securityRaw);
  if (security) {
    result.bidSecurityAmount = security;
    confidence.bidSecurityAmount = 0.85;
  }

  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(flat)?.[0];
  if (email) {
    result.contactEmail = email;
    confidence.contactEmail = 0.9;
  }

  const phone = /(?:\+92|0092|0)\s?[-()]?\d{2,4}[-)\s]?\d{3,4}[- ]?\d{3,4}/.exec(flat)?.[0];
  if (phone) {
    result.contactPhone = oneLine(phone);
    confidence.contactPhone = 0.8;
  }

  const contactName = firstMatch(text, [
    /(?:contact person|contact name|name of contact)\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})/i,
  ]);
  if (contactName) {
    result.contactName = trimAtNextLabel(contactName);
    confidence.contactName = 0.8;
  }

  const address = firstMatch(text, [
    /(?:office address|postal address|address)\s*[:\-]\s*([^\n|]{8,180})/i,
  ]);
  if (address) {
    result.contactAddress = trimAtNextLabel(address);
    confidence.contactAddress = 0.7;
  }

  const organization = firstMatch(text, [
    /(?:organization(?: name)?|organisation(?: name)?|procuring agency|department|office name|issuing authority)\s*[:\-]\s*([^\n|]{3,160})/i,
  ]);
  if (organization) {
    result.organization = trimAtNextLabel(organization);
    confidence.organization = 0.85;
  }

  const eligibility = extractSection(
    text,
    [/\b(?:eligibility(?: criteria)?|qualification(?: criteria)?|bidder eligibility)\b[ \t]*[:\-]?[ \t]*/i],
    600,
  );
  if (eligibility) {
    result.eligibility = eligibility;
    confidence.eligibility = 0.8;
  }

  const docsSection = extractSection(
    text,
    [/\b(?:required documents?|documents required|bid documents?|documents to be submitted)\b[ \t]*[:\-]?[ \t]*/i],
    500,
  );
  if (docsSection) {
    const docs = docsSection
      .split(/\n|;|•|·|\u2022|\|/)
      .map((entry) => oneLine(entry).replace(/^[-*\d.)\s]+/, ""))
      .filter((entry) => entry.length >= 3 && entry.length <= 120)
      .slice(0, 15);
    if (docs.length > 0) {
      result.requiredDocuments = docs;
      confidence.requiredDocuments = 0.75;
    }
  }

  const category = CATEGORY_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(flat)));
  if (category) {
    result.categorySlug = category.slug;
    confidence.categorySlug = 0.65;
  }

  const tenderTypeRule = TENDER_TYPE_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(flat)));
  if (tenderTypeRule?.type) {
    result.tenderType = tenderTypeRule.type;
    confidence.tenderType = 0.7;
  } else if (ctx.sourceCategory === "NEWSPAPER") {
    result.tenderType = "NEWSPAPER";
    confidence.tenderType = 0.9;
  } else if (ctx.sourceCategory === "PRIVATE") {
    result.tenderType = "PRIVATE";
    confidence.tenderType = 0.8;
  } else {
    result.tenderType = "GOVERNMENT";
    confidence.tenderType = 0.6;
  }

  const city = findLocation(flat, ctx.cities);
  if (city) {
    result.citySlug = city.slug;
    confidence.citySlug = 0.75;
    if (city.provinceSlug) {
      result.provinceSlug = city.provinceSlug;
      confidence.provinceSlug = 0.75;
    }
  }
  if (!result.provinceSlug) {
    const province = findLocation(flat, ctx.provinces);
    if (province) {
      result.provinceSlug = province.slug;
      confidence.provinceSlug = 0.7;
    } else if (ctx.defaultProvinceSlug) {
      result.provinceSlug = ctx.defaultProvinceSlug;
      confidence.provinceSlug = 0.55;
    }
  }

  if (!result.referenceNumber) warnings.push("No tender reference number was found in the source.");
  if (!result.closingAt) warnings.push("No closing date was found in the source.");
  if (!result.organization) warnings.push("No organization name was found in the source.");

  return result;
}

export function firstMeaningfulLine(text: string): string | null {
  for (const line of cleanText(text).split("\n")) {
    const value = oneLine(line);
    if (value.length >= 8 && !/^(page|home|tenders?|menu|login|download)\b/i.test(value)) return value;
  }
  return null;
}

export function normalizeReference(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length >= 3 ? normalized : null;
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(tender|notice|invitation|request for|rfp|rfq|eoi|ifb|nit|bid|procurement|supply of|providing of|purchase of)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOrganization(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(office of the|office of|directorate of|department of|government of|govt\.? of|the)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length >= 3 ? normalized : null;
}
