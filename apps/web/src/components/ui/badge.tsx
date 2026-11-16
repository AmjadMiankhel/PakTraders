import type { ReactNode } from "react";
import { cn } from "@paktenders/shared-utils";
import type { TenderStatus, TenderType, VerificationStatus } from "@paktenders/shared-types";

type Tone = "green" | "amber" | "red" | "slate" | "navy" | "purple" | "sky";

const tones: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  navy: "bg-navy-50 text-navy-700 ring-1 ring-navy-200",
  purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}

const statusMap: Record<TenderStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  PENDING_VERIFICATION: { label: "Pending review", tone: "amber" },
  PUBLISHED: { label: "Open", tone: "green" },
  CLOSED: { label: "Closed", tone: "slate" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  ARCHIVED: { label: "Archived", tone: "slate" },
};

const verificationMap: Record<VerificationStatus, { label: string; tone: Tone }> = {
  VERIFIED: { label: "Verified", tone: "green" },
  PENDING: { label: "Verification pending", tone: "amber" },
  UNVERIFIED: { label: "Unverified", tone: "slate" },
  DEMO: { label: "Demo record", tone: "purple" },
};

const typeLabels: Record<TenderType, string> = {
  GOVERNMENT: "Government",
  PRIVATE: "Private",
  NGO: "NGO",
  AUCTION: "Auction",
  CONSULTANCY: "Consultancy",
  NEWSPAPER: "Newspaper",
};

export function TenderStatusBadge({ status }: { status: TenderStatus }) {
  const config = statusMap[status] ?? statusMap.DRAFT;
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const config = verificationMap[status] ?? verificationMap.UNVERIFIED;
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function TenderTypeBadge({ type }: { type: TenderType }) {
  return <Badge tone="navy">{typeLabels[type] ?? type}</Badge>;
}
