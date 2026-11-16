import Link from "next/link";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">
        <Compass className="h-8 w-8" />
      </span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">404</p>
      <h1 className="mt-2 text-3xl font-bold text-navy-900">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-500">
        The tender, category or page may have been moved, closed or removed. Try searching the
        tender directory instead.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/tenders">Browse tenders</ButtonLink>
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
