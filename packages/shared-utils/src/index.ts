import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const PKT_TIMEZONE = "Asia/Karachi";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const pkrCompact = new Intl.NumberFormat("en-PK", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format a PKR amount, e.g. 1250000 -> "Rs 1,250,000". */
export function formatPkr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not disclosed";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "Not disclosed";
  return pkrFormatter.format(n).replace("PKR", "Rs");
}

/** Compact PKR for stat tiles, e.g. 1250000 -> "Rs 1.3M". */
export function formatPkrCompact(value: number): string {
  return `Rs ${pkrCompact.format(value)}`;
}

export function formatDatePkt(
  input: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", { ...opts, timeZone: PKT_TIMEZONE }).format(date);
}

export function formatDateTimePkt(input: Date | string | null | undefined): string {
  return formatDatePkt(input, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Whole days between now and a deadline (PKT calendar day boundary). */
export function daysRemaining(closingAt: Date | string | null | undefined): number | null {
  if (!closingAt) return null;
  const end = typeof closingAt === "string" ? new Date(closingAt) : closingAt;
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function relativeDeadline(closingAt: Date | string | null | undefined): string {
  const days = daysRemaining(closingAt);
  if (days === null) return "No closing date";
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `${days} days left`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96);
}

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Build a query string, dropping empty values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function absoluteUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

/** Convert "15m" / "30d" / "3600s" into seconds. Defaults to 15 minutes. */
export function parseDurationSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };
  return value * (multipliers[unit] ?? 1);
}
