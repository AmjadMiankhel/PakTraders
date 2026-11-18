import Link from "next/link";
import { Building2, CalendarClock, MapPin, Wallet } from "lucide-react";
import type { TenderSummary } from "@paktenders/shared-types";
import { formatDatePkt, formatPkr, relativeDeadline } from "@paktenders/shared-utils";
import { TenderStatusBadge, TenderTypeBadge, VerificationBadge } from "@/components/ui/badge";

export function TenderCard({ tender }: { tender: TenderSummary }) {
  const closingTone =
    tender.daysRemaining !== null && tender.daysRemaining >= 0 && tender.daysRemaining <= 3
      ? "text-red-600"
      : "text-ink-500";

  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        <TenderTypeBadge type={tender.tenderType} />
        <TenderStatusBadge status={tender.status} />
        {tender.verificationStatus === "DEMO" ? <VerificationBadge status="DEMO" /> : null}
        {tender.isFeatured ? (
          <span className="badge bg-amber-50 text-amber-800 ring-1 ring-amber-200">Featured</span>
        ) : null}
      </div>

      <h3 className="mt-3 text-base font-semibold leading-6 text-navy-900">
        <Link href={`/tenders/${tender.slug}`} className="hover:text-emerald-700">
          {tender.title}
        </Link>
      </h3>

      <p className="mt-1 text-xs font-medium text-emerald-700">{tender.category.name}</p>

      <dl className="mt-4 space-y-2 text-xs text-ink-500">
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400" />
          <dd className="line-clamp-2">
            {tender.department.shortName ?? tender.department.name}
            {tender.referenceNumber ? <span className="text-ink-500"> · {tender.referenceNumber}</span> : null}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400" />
          <dd>
            {tender.city ? `${tender.city.name}, ` : ""}
            {tender.province.name}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400" />
          <dd className={closingTone}>
            {tender.closingAt ? (
              <>
                Closes {formatDatePkt(tender.closingAt)}
                {tender.daysRemaining !== null ? ` · ${relativeDeadline(tender.closingAt)}` : ""}
              </>
            ) : (
              "Closing date not published"
            )}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-400" />
          <dd>{tender.estimatedValue ? formatPkr(tender.estimatedValue) : "Value not disclosed"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[11px] text-ink-500">
          Published {tender.publishedAt ? formatDatePkt(tender.publishedAt) : "—"}
        </span>
        <Link
          href={`/tenders/${tender.slug}`}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View details →
        </Link>
      </div>
    </article>
  );
}
