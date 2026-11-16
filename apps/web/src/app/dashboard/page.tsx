import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing, Bookmark, CalendarClock, CreditCard } from "lucide-react";
import { formatDatePkt, formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert, SectionHeading, StatTile } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { apiFetchAuthed } from "@/lib/server-api";
import type {
  AlertRuleDto,
  MyProfile,
  NotificationsResponse,
  SavedTendersResponse,
} from "@/lib/account-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const emptySaved: SavedTendersResponse = {
  items: [],
  meta: { page: 1, pageSize: 1, total: 0, totalPages: 1 },
};

const emptyNotifications: NotificationsResponse = {
  items: [],
  unread: 0,
  meta: { page: 1, pageSize: 5, total: 0, totalPages: 1 },
};

export default async function DashboardPage() {
  const [profile, saved, alerts, notifications] = await Promise.all([
    apiFetchAuthed<MyProfile | null>("/v1/me/profile", null),
    apiFetchAuthed<SavedTendersResponse>("/v1/me/saved-tenders?pageSize=1", emptySaved),
    apiFetchAuthed<AlertRuleDto[]>("/v1/me/alerts", []),
    apiFetchAuthed<NotificationsResponse>("/v1/me/notifications?pageSize=5", emptyNotifications),
  ]);

  const activeAlerts = alerts.filter((alert) => alert.isActive).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">
          {profile ? `Welcome back, ${profile.fullName.split(" ")[0]}` : "Your dashboard"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Track saved tenders, alert rules and notifications in one place.
        </p>
      </div>

      {!profile ? (
        <Alert tone="error">
          Your profile could not be loaded right now. Refresh the page or sign in again.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Saved tenders"
          value={saved.meta.total}
          hint="Synced across web and mobile"
          icon={<Bookmark className="h-5 w-5" />}
        />
        <StatTile
          label="Alert rules"
          value={alerts.length}
          hint={`${activeAlerts} active`}
          icon={<BellRing className="h-5 w-5" />}
        />
        <StatTile
          label="Unread notifications"
          value={notifications.unread}
          hint="In-app messages"
          icon={<Bell className="h-5 w-5" />}
        />
        <StatTile
          label="Current plan"
          value={profile?.subscription?.planName ?? "Free"}
          hint={
            profile?.subscription?.endsAt
              ? `Renews / ends ${formatDatePkt(profile.subscription.endsAt)}`
              : "No paid subscription"
          }
          icon={<CreditCard className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-navy-900">Recent notifications</h2>
            <Link href="/dashboard/notifications" className="text-xs font-semibold text-emerald-700 hover:underline">
              View all
            </Link>
          </div>
          {notifications.items.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {notifications.items.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-500">{item.body}</p>
                    </div>
                    {!item.isRead ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">{formatDateTimePkt(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-500">
              No notifications yet. Alerts you create will appear here when they run.
            </p>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-navy-900">Your alert rules</h2>
            <Link href="/dashboard/alerts" className="text-xs font-semibold text-emerald-700 hover:underline">
              Manage
            </Link>
          </div>
          {alerts.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {alerts.slice(0, 4).map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-900">{alert.name}</p>
                    <p className="text-xs text-ink-500">
                      {alert.frequency.toLowerCase()} · {alert.channels.join(", ")}
                    </p>
                  </div>
                  <span
                    className={
                      alert.isActive
                        ? "badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "badge bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                    }
                  >
                    {alert.isActive ? "Active" : "Paused"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-500">
              No alert rules yet. Create one to be notified about matching tenders.
            </p>
          )}
        </section>
      </div>

      <section>
        <SectionHeading title="Quick actions" description="Jump straight to the most common tasks." />
        <div className="grid gap-3 sm:grid-cols-3">
          <ButtonLink href="/tenders" variant="secondary" className="justify-start">
            Browse tenders
          </ButtonLink>
          <ButtonLink href="/dashboard/alerts" variant="secondary" className="justify-start">
            Create an alert
          </ButtonLink>
          <ButtonLink href="/dashboard/profile" variant="secondary" className="justify-start">
            Complete your profile
          </ButtonLink>
        </div>
      </section>

      {saved.meta.total === 0 ? (
        <EmptyState
          title="You have not saved any tenders yet"
          description="Save a tender from its detail page to keep it here. Saved tenders sync with the mobile apps."
          icon={<CalendarClock className="h-7 w-7" />}
          action={<ButtonLink href="/tenders">Find tenders to save</ButtonLink>}
        />
      ) : null}
    </div>
  );
}
