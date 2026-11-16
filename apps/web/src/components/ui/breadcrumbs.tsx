import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
        <li>
          <Link href="/" className="hover:text-navy-900">
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-ink-500/50" />
            {item.href ? (
              <Link href={item.href} className="hover:text-navy-900">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-ink-700">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
