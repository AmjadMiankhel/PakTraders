import Link from "next/link";
import { cn } from "@paktenders/shared-utils";

export function Logo({
  variant = "dark",
  className,
  showTagline = false,
}: {
  variant?: "dark" | "light";
  className?: string;
  showTagline?: boolean;
}) {
  const primary = variant === "light" ? "text-white" : "text-navy-900";
  const secondary = variant === "light" ? "text-emerald-300" : "text-emerald-700";
  const muted = variant === "light" ? "text-white/60" : "text-ink-500";

  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} title="Pak Tenders home">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-900 via-navy-700 to-emerald-700 shadow-sm">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M12 2.75 4.5 5.9v5.2c0 4.4 3.1 8.2 7.5 9.9 4.4-1.7 7.5-5.5 7.5-9.9V5.9L12 2.75Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8.75 9h6.5M8.75 12h6.5M8.75 15h4" stroke="#6EE7B7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={cn("block text-[17px] font-extrabold tracking-tight", primary)}>
          Pak <span className={secondary}>Tenders</span>
        </span>
        {showTagline ? (
          <span className={cn("block text-[10px] font-semibold uppercase tracking-[0.14em]", muted)}>
            Discover · Analyze · Track · Win
          </span>
        ) : null}
      </span>
    </Link>
  );
}
