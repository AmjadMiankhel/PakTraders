"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * Rendered instead of a server-side `redirect()` when a visitor is not signed in.
 *
 * Next.js' streamed redirect from a server component is not reliable behind
 * every front proxy: on Hostinger's LiteSpeed + CDN the visitor received `200`
 * with an empty body instead of the login page. Returning real markup keeps the
 * gate working everywhere.
 *
 * The component also restores an expired session before bouncing the visitor:
 * the access token lives 15 minutes, so it asks the refresh route handler for a
 * new one and only falls back to the sign-in page when that fails. This is why
 * the website does not need middleware to keep sessions alive.
 */
const REFRESH_ATTEMPT_KEY = "pt-auth-refresh-at";
const REFRESH_WINDOW_MS = 15_000;

function recentlyAttempted(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(REFRESH_ATTEMPT_KEY) ?? 0);
    return Date.now() - at < REFRESH_WINDOW_MS;
  } catch {
    return false;
  }
}

function markAttempt(): void {
  try {
    window.sessionStorage.setItem(REFRESH_ATTEMPT_KEY, String(Date.now()));
  } catch {
    // Private mode: fall through to the sign-in page on the next attempt.
  }
}

export function AuthRequired({ next, reason }: { next: string; reason?: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const href = `/login?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    let active = true;

    const fallback = () => {
      if (active) router.replace(href);
    };

    if (recentlyAttempted()) {
      setChecking(false);
      fallback();
      return () => {
        active = false;
      };
    }

    markAttempt();
    fetch("/api/auth/refresh", { method: "POST", headers: { accept: "application/json" } })
      .then((response) => {
        if (!active) return;
        if (response.ok) {
          // Cookies are rotated; re-render the protected route with them.
          router.replace(next);
          router.refresh();
          return;
        }
        setChecking(false);
        fallback();
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
        fallback();
      });

    return () => {
      active = false;
    };
  }, [href, next, router]);

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-900">
          {checking ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <h1 className="text-xl font-bold text-navy-900">
          {checking ? "Restoring your session" : "Sign in to continue"}
        </h1>
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
          If nothing happens,{" "}
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
