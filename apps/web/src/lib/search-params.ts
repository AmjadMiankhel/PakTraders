export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parsePositiveInt(value: string | undefined, fallback: number, max = 10_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function tenderQueryString(params: RawSearchParams): string {
  const allowed = [
    "q",
    "category",
    "province",
    "city",
    "department",
    "type",
    "closingWithinDays",
    "sort",
    "page",
    "pageSize",
  ];
  const search = new URLSearchParams();
  for (const key of allowed) {
    const value = firstValue(params[key]);
    if (value && value.trim()) search.set(key, value.trim());
  }
  if (!search.has("pageSize")) search.set("pageSize", "12");
  return search.toString();
}
