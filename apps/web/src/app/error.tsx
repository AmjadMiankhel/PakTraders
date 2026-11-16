"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-2xl font-bold text-navy-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-500">
        The page could not be loaded. This is usually temporary — try again, or return to the tender
        directory.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
        <a href="/tenders" className="btn-secondary">
          Browse tenders
        </a>
      </div>
      {error.digest ? <p className="mt-4 text-xs text-ink-500">Reference: {error.digest}</p> : null}
    </div>
  );
}
