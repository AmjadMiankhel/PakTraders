import { cache } from "react";
import type { TenderDetail, TenderSummary } from "@paktenders/shared-types";
import { apiFetch } from "./server-api";

/** Request-scoped cache so metadata and page render share one API call. */
export const getTenderBySlug = cache(async (slug: string) =>
  apiFetch<TenderDetail>(`/v1/tenders/${encodeURIComponent(slug)}`),
);

export const getSimilarTenders = cache(async (slug: string, limit = 3) =>
  apiFetch<TenderSummary[]>(
    `/v1/tenders/${encodeURIComponent(slug)}/similar?limit=${limit}`,
  ),
);
