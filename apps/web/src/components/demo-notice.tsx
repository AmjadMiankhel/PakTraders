import { Info } from "lucide-react";
import Link from "next/link";

export function DemoNotice({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-6">
        <span className="font-semibold">Demo data notice.</span> This environment contains {count}{" "}
        clearly labelled sample tender{count === 1 ? "" : "s"} for product evaluation. They are not
        real procurement notices.{" "}
        <Link href="/disclaimer" className="font-semibold underline underline-offset-2">
          Read the disclaimer
        </Link>
        .
      </p>
    </div>
  );
}
