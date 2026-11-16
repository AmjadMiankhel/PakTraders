import { Badge } from "@/components/ui/badge";
import { cn } from "@paktenders/shared-utils";

type Tone = "green" | "amber" | "red" | "slate" | "navy" | "purple" | "sky";

const sourceTones: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "green" },
  PAUSED: { label: "Paused", tone: "amber" },
  DEGRADED: { label: "Degraded", tone: "amber" },
  DISABLED: { label: "Disabled", tone: "slate" },
  PENDING_REVIEW: { label: "Pending review", tone: "sky" },
};

const runTones: Record<string, { label: string; tone: Tone }> = {
  QUEUED: { label: "Queued", tone: "navy" },
  RUNNING: { label: "Running", tone: "sky" },
  SUCCEEDED: { label: "Succeeded", tone: "green" },
  PARTIAL: { label: "Partial", tone: "amber" },
  FAILED: { label: "Failed", tone: "red" },
  SKIPPED: { label: "Skipped", tone: "slate" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
};

const ingestTones: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "navy" },
  UPDATED: { label: "Updated", tone: "sky" },
  DUPLICATE: { label: "Duplicate", tone: "purple" },
  NEEDS_REVIEW: { label: "Needs review", tone: "amber" },
  PUBLISHED: { label: "Published", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  FAILED: { label: "Failed", tone: "red" },
  UNCHANGED: { label: "Unchanged", tone: "slate" },
};

const decisionTones: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  MERGED: { label: "Merged", tone: "green" },
  KEPT_SEPARATE: { label: "Kept separate", tone: "slate" },
  IGNORED: { label: "Ignored", tone: "slate" },
};

const ocrTones: Record<string, { label: string; tone: Tone }> = {
  NOT_REQUIRED: { label: "Not required", tone: "slate" },
  PENDING: { label: "OCR pending", tone: "amber" },
  COMPLETED: { label: "OCR done", tone: "green" },
  FAILED: { label: "OCR failed", tone: "red" },
  UNSUPPORTED: { label: "OCR unsupported", tone: "slate" },
};

function mapBadge(map: Record<string, { label: string; tone: Tone }>, value: string) {
  const config = map[value] ?? { label: value.replaceAll("_", " "), tone: "slate" as Tone };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function SourceStatusBadge({ status }: { status: string }) {
  return mapBadge(sourceTones, status);
}

export function RunStatusBadge({ status }: { status: string }) {
  return mapBadge(runTones, status);
}

export function IngestStatusBadge({ status }: { status: string }) {
  return mapBadge(ingestTones, status);
}

export function DuplicateDecisionBadge({ decision }: { decision: string }) {
  return mapBadge(decisionTones, decision);
}

export function OcrStatusBadge({ status }: { status: string }) {
  return mapBadge(ocrTones, status);
}

export function ConfidenceValue({
  value,
  label = "confidence",
}: {
  value: number | null | undefined;
  label?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-ink-400">No {label}</span>;
  }
  const percent = Math.round(value * 100);
  const tone =
    percent >= 85 ? "text-emerald-700" : percent >= 60 ? "text-amber-700" : "text-red-700";
  return (
    <span className={cn("text-xs font-semibold tabular-nums", tone)} title={`${label}: ${percent}%`}>
      {percent}% {label}
    </span>
  );
}

export function MatchTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    EXACT_SOURCE_ID: "Same source ID",
    EXACT_REFERENCE: "Same reference number",
    EXACT_DOCUMENT: "Same document",
    EXACT_URL: "Same source URL",
    FUZZY: "Similar record",
  };
  return <span>{labels[type] ?? type.replaceAll("_", " ").toLowerCase()}</span>;
}
