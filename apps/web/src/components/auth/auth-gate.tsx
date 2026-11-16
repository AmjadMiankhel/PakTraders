"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * Rendered instead of a server-side `redirect()` when a visitor is not signed in.
 *
 * Next.js' streamed redirect from a server component is not reliable behind
 * every front proxy: on Hostinger's LiteSpeed + CDN the visitor received `200`
 * with an empty body instead of the login page. Returning real markup keeps the
 * gate working everywhere, and the client-side replace upgrades it to the same
 * instant redirect users get on hosts where the streamed redirect survives.
 */
export function AuthRequired({ next, reason }: { next: string; reason?: string }) {
  const router = useRouter();
  const href = `/login?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-900">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold text-navy-900">Sign in to continue</h1>
        <p className="mt-2 text-sm text-ink-500">
          {reason ??
            "This page shows your saved tenders, searches and alerts, so it needs an account."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href={href}>Sign in</ButtonLink>
          <ButtonLink href={`/register?next=${encodeURIComponent(next)}`} variant="secondary">
            Create a free account
          </ButtonLink>
        </div>
        <p className="mt-4 text-xs text-ink-500">
          Taking you to the sign-in page automatically. If nothing happens,{" "}
          <Link href={href} className="font-semibold text-navy-900 underline">
            continue manually
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Rendered when a signed-in account lacks staff access to the control center. */
export function AccessDenied() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold text-navy-900">Staff access required</h1>
        <p className="mt-2 text-sm text-ink-500">
          Your account is signed in but does not have a staff role for the Super Admin Control
          Center. Ask a super admin to grant access, or continue to your dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact support
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
