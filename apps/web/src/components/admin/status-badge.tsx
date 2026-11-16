import { Badge } from "@/components/ui/badge";

const toneMap: Record<string, "green" | "amber" | "red" | "slate" | "sky" | "navy"> = {
  ACTIVE: "green",
  CONNECTED: "green",
  CONFIGURED: "sky",
  TRIAL: "sky",
  PENDING: "amber",
  TESTING: "amber",
  ERROR: "red",
  FAILED: "red",
  SUSPENDED: "red",
  NOT_CONFIGURED: "slate",
  DISABLED: "slate",
  EXPIRED: "slate",
  CANCELLED: "slate",
  ok: "green",
  connected: "green",
  configured: "sky",
  not_configured: "slate",
  disabled: "slate",
  unreachable: "red",
};

export function IntegrationStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={toneMap[status] ?? "slate"}>
      {status.replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase())}
    </Badge>
  );
}
