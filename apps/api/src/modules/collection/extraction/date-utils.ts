const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const PKT_OFFSET = "+05:00";

export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function oneLine(input: string | null | undefined): string {
  return cleanText(input).replace(/\s+/g, " ").trim();
}

function buildPktDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${PKT_OFFSET}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible dates such as 31 February.
  const check = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (check !== `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`) {
    return null;
  }
  return date;
}

export interface ParsedTime {
  hour: number;
  minute: number;
}

export function parseTime(input: string | null | undefined): ParsedTime | null {
  if (!input) return null;
  const text = oneLine(input).toLowerCase();
  // Only treat something as a time when it is unambiguous. A bare number is
  // usually a day of the month ("13 August, 2024"), and "13.08.2024" is a
  // date, not the time 13:08. Colon times and any am/pm marker are safe.
  let hour: number | null = null;
  let minute = 0;
  let meridiem: string | undefined;

  let match = /(?:^|[^\d])(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/.exec(text);
  if (match) {
    hour = Number(match[1]);
    minute = Number(match[2]);
    meridiem = match[3]?.replace(/\./g, "");
  } else if ((match = /(?:^|[^\d])(\d{1,2})\.(\d{2})\s*(am|pm|a\.m\.|p\.m\.)/.exec(text))) {
    hour = Number(match[1]);
    minute = Number(match[2]);
    meridiem = match[3]?.replace(/\./g, "");
  } else if ((match = /(?:^|[^\d])(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/.exec(text))) {
    hour = Number(match[1]);
    meridiem = match[2]?.replace(/\./g, "");
  }

  if (hour === null) return null;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

/**
 * Parses the date formats used by Pakistani procurement portals and
 * advertisements. Dates without a timezone are interpreted as Asia/Karachi.
 * When no time is published the caller decides whether the start or end of
 * the day is appropriate; the time is never fabricated into the source text.
 */
export function parseFlexibleDate(
  input: string | Date | null | undefined,
  options: { endOfDay?: boolean; fallbackTime?: ParsedTime } = {},
): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  const text = oneLine(String(input));
  if (!text) return null;

  // A full ISO timestamp already carries an offset or is unambiguous UTC.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const time = parseTime(text);
  const hour = options.fallbackTime?.hour ?? time?.hour ?? (options.endOfDay ? 23 : 0);
  const minute = options.fallbackTime?.minute ?? time?.minute ?? (options.endOfDay ? 59 : 0);

  const cleaned = text
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();

  // 2026-11-13 / 2026/11/13
  let match = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(cleaned);
  if (match) {
    return buildPktDate(Number(match[1]), Number(match[2]), Number(match[3]), hour, minute);
  }

  // 13-11-2026 / 13/11/2026 / 13.11.2026
  match = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(cleaned);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return buildPktDate(year, Number(match[2]), Number(match[1]), hour, minute);
  }

  // 13 November 2026 / 13-Nov-2026
  match = /(\d{1,2})[\s-]+([a-z]+)[\s,-]+(\d{4})/i.exec(cleaned);
  if (match) {
    const month = MONTHS[match[2]?.toLowerCase() ?? ""];
    if (month) return buildPktDate(Number(match[3]), month, Number(match[1]), hour, minute);
  }

  // November 13, 2026 / Nov 13 2026
  match = /([a-z]+)[\s-]+(\d{1,2})[\s,]+(\d{4})/i.exec(cleaned);
  if (match) {
    const month = MONTHS[match[1]?.toLowerCase() ?? ""];
    if (month) return buildPktDate(Number(match[3]), month, Number(match[2]), hour, minute);
  }

  // Last resort: native parsing for formats such as RFC 2822 used in RSS.
  const native = new Date(cleaned);
  return Number.isNaN(native.getTime()) ? null : native;
}

/** Formats a PKT date for compact display inside run logs. */
export function pktIso(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Adds a duration without relying on local server timezone. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
