import { oneLine } from "./date-utils";

const MULTIPLIERS: Record<string, number> = {
  crore: 10_000_000,
  karor: 10_000_000,
  kharab: 100_000_000_000,
  lakh: 100_000,
  lac: 100_000,
  million: 1_000_000,
  mn: 1_000_000,
  billion: 1_000_000_000,
  bn: 1_000_000_000,
};

/** Converts a published money string (Rs, lakh, crore) to a PKR decimal string. */
export function parseAmountFromText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = oneLine(raw).toLowerCase().replace(/,/g, "");
  if (!/\d/.test(text)) return null;
  const match = /(\d+(?:\.\d+)?)\s*(crore|karor|kharab|lakh|lac|million|billion|mn|bn)?/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const multiplier = MULTIPLIERS[match[2] ?? ""] ?? 1;
  return (value * multiplier).toFixed(2);
}

/** Finds a plausible tender reference in free text without guessing one. */
export function parseReferenceFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const flat = oneLine(text);
  const patterns = [
    /(?:tender|bid|rfp|rfq|eoi|ifb|nit|reference|ref)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/_.()-]{3,40})/gi,
    /\b(TS\d{6,}[A-Z]?)\b/gi,
    /\b([A-Z]{2,10}[-/][A-Z0-9][A-Z0-9/_.()-]{2,30})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of flat.matchAll(pattern)) {
      const value = match?.[1]?.replace(/[.,;:]$/, "");
      if (!value) continue;
      // Real references contain at least one digit. Without this check the
      // optional "no." label matches the "NO" inside "TENDER NOTICE" and
      // captures "TICE" as a reference number.
      if (!/\d/.test(value)) continue;
      if (/^(tender|notice|number|reference|document)$/i.test(value)) continue;
      return value;
    }
  }
  return null;
}

const DOCUMENT_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt|png|jpe?g|tiff?|webp|gif)$/i;

/**
 * True when a URL points at a downloadable document rather than a site page.
 * Government sites often place "Downloads" navigation links next to tender
 * documents; downloading those pages produces HTML (or 403s) and must never be
 * stored as a tender document. Download endpoints that identify the file in the
 * query string (for example PPRA's /pdf?file=...) are accepted.
 */
export function isDocumentUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const path = decodeURIComponent(parsed.pathname);
  if (DOCUMENT_EXTENSION.test(path)) return true;
  if (/\/storage\//i.test(path) || /\/uploadfiles\//i.test(path)) return true;
  if (/(?:^|\/)(?:force_download|download|file|attachment|documents?|pdf)(?:\/|$)/i.test(path) && parsed.search) {
    return true;
  }
  return false;
}

/** Deterministic JSON stringify used for change-detection hashes. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/** Jaccard similarity over normalized word sets. */
export function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((word) => word.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((word) => word.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const word of wordsA) if (wordsB.has(word)) intersection += 1;
  return intersection / (wordsA.size + wordsB.size - intersection);
}
