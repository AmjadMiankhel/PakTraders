"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@paktenders/shared-utils";
import type { ActionResult } from "@/lib/actions";

export function ActionButton({
  action,
  children,
  pendingLabel,
  confirm,
  className,
  variant = "secondary",
  title,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel?: string;
  confirm?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : variant === "ghost"
          ? "btn-ghost"
          : "btn-secondary";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={title}
        disabled={pending}
        className={cn(variantClass, "px-3 py-1.5 text-xs", className)}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setMessage(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) {
              setMessage(result.message ?? "Action failed");
            } else {
              router.refresh();
            }
          });
        }}
      >
        {pending ? (pendingLabel ?? "Working…") : children}
      </button>
      {message ? <span className="text-xs text-red-600">{message}</span> : null}
    </span>
  );
}
