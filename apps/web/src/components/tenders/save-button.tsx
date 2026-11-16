"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleSavedTender } from "@/lib/actions";

export function SaveTenderButton({
  tenderId,
  slug,
  isSaved,
  isAuthenticated,
}: {
  tenderId: string;
  slug: string;
  isSaved: boolean;
  isAuthenticated: boolean;
}) {
  const [saved, setSaved] = useState(isSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className={saved ? "btn-secondary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}
        onClick={() => {
          if (!isAuthenticated) {
            router.push(`/login?next=${encodeURIComponent(`/tenders/${slug}`)}`);
            return;
          }
          const next = !saved;
          startTransition(async () => {
            const result = await toggleSavedTender(tenderId, next, slug);
            if (result.ok) {
              setSaved(next);
              router.refresh();
            } else {
              setError(result.message ?? "Could not update saved tenders");
            }
          });
        }}
      >
        {saved ? <BookmarkCheck className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4" />}
        {pending ? "Saving…" : saved ? "Saved" : "Save tender"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
