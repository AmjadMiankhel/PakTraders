"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@paktenders/shared-utils";
import type { ActionResult } from "@/lib/actions";
import { Alert } from "@/components/ui/feedback";

type Action = (formData: FormData) => Promise<ActionResult>;

export function SubmitButton({
  children,
  className,
  pendingLabel = "Saving…",
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("btn-primary", className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  footer,
  hideSubmit = false,
  successMessage,
}: {
  action: Action;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  footer?: ReactNode;
  hideSubmit?: boolean;
  successMessage?: string;
}) {
  const [state, formAction] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  return (
    <form action={formAction} className={cn("space-y-4", className)}>
      {children}
      {state ? (
        <Alert tone={state.ok ? "success" : "error"}>
          {state.ok ? (successMessage ?? state.message ?? "Saved") : (state.message ?? "Could not save")}
        </Alert>
      ) : null}
      {hideSubmit ? null : (
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
          {footer}
        </div>
      )}
    </form>
  );
}
