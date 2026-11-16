import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { ActionButton } from "@/components/forms/action-button";
import { EmptyState, Pagination } from "@/components/ui/states";
import { apiFetchAuthed } from "@/lib/server-api";
import { markNotificationsRead } from "@/lib/actions";
import type { NotificationsResponse } from "@/lib/account-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

const empty: NotificationsResponse = {
  items: [],
  unread: 0,
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const data = await apiFetchAuthed<NotificationsResponse>(
    `/v1/me/notifications?page=${page}&pageSize=20`,
    empty,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Notifications</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data.unread > 0 ? `${data.unread} unread` : "You are all caught up"} ·{" "}
            {data.meta.total.toLocaleString("en-PK")} total
          </p>
        </div>
        {data.unread > 0 ? (
          <ActionButton action={markNotificationsRead} variant="secondary">
            Mark all as read
          </ActionButton>
        ) : null}
      </div>

      {data.items.length > 0 ? (
        <>
          <div className="card divide-y divide-line">
            {data.items.map((item) => (
              <article key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-navy-900">{item.title}</h2>
                      {!item.isRead ? (
                        <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-ink-600">{item.body}</p>
                    <p className="mt-1 text-[11px] text-ink-500">
                      {item.type.toLowerCase()} · {formatDateTimePkt(item.createdAt)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination meta={data.meta} basePath="/dashboard/notifications" />
        </>
      ) : (
        <EmptyState
          title="No notifications yet"
          description="When your alert rules match new tenders, messages will appear here."
          icon={<Bell className="h-7 w-7" />}
        />
      )}
    </div>
  );
}
