import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@paktenders/shared-utils";
import type { PaginationMeta } from "@paktenders/shared-types";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-navy-300">{icon}</div> : null}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Pagination({
  meta,
  basePath,
  searchParams = {},
}: {
  meta: PaginationMeta;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  if (meta.totalPages <= 1) return null;

  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages = new Set<number>([1, meta.totalPages, meta.page, meta.page - 1, meta.page + 1]);
  const ordered = [...pages].filter((page) => page >= 1 && page <= meta.totalPages).sort((a, b) => a - b);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-ink-500">
        Page <span className="font-semibold text-ink-700">{meta.page}</span> of {meta.totalPages} ·{" "}
        {meta.total.toLocaleString("en-PK")} results
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={href(Math.max(1, meta.page - 1))}
          aria-disabled={meta.page === 1}
          className={cn(
            "btn-secondary px-3 py-1.5 text-xs",
            meta.page === 1 && "pointer-events-none opacity-50",
          )}
        >
          Previous
        </Link>
        {ordered.map((page, index) => {
          const previous = ordered[index - 1];
          const gap = previous !== undefined && page - previous > 1;
          return (
            <span key={page} className="flex items-center gap-1">
              {gap ? <span className="px-1 text-ink-500">…</span> : null}
              <Link
                href={href(page)}
                aria-current={page === meta.page ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold",
                  page === meta.page
                    ? "bg-navy-900 text-white"
                    : "border border-line bg-white text-ink-700 hover:bg-surface",
                )}
              >
                {page}
              </Link>
            </span>
          );
        })}
        <Link
          href={href(Math.min(meta.totalPages, meta.page + 1))}
          aria-disabled={meta.page === meta.totalPages}
          className={cn(
            "btn-secondary px-3 py-1.5 text-xs",
            meta.page === meta.totalPages && "pointer-events-none opacity-50",
          )}
        >
          Next
        </Link>
      </div>
    </nav>
  );
}
