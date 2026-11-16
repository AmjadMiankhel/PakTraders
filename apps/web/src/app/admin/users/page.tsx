import type { Metadata } from "next";
import Link from "next/link";
import { formatDatePkt, formatDateTimePkt } from "@paktenders/shared-utils";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Pagination } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { apiFetchAuthed } from "@/lib/server-api";
import { getCurrentUser } from "@/lib/auth";
import { updateUserStatus } from "@/lib/actions";
import type { AdminUsersResponse } from "@/lib/admin-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

const empty: AdminUsersResponse = {
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

const statusTone: Record<string, "green" | "amber" | "red" | "slate"> = {
  ACTIVE: "green",
  PENDING_EMAIL_VERIFICATION: "amber",
  SUSPENDED: "red",
  DELETED: "slate",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const q = firstValue(params.q) ?? "";
  const status = firstValue(params.status) ?? "";

  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (q.trim()) query.set("q", q.trim());
  if (status) query.set("status", status);

  const [data, currentUser] = await Promise.all([
    apiFetchAuthed<AdminUsersResponse>(`/v1/admin/users?${query.toString()}`, empty),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Users</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data.meta.total.toLocaleString("en-PK")} account{data.meta.total === 1 ? "" : "s"}.
          Suspending a user revokes their active sessions.
        </p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-48 flex-1">
          <label htmlFor="user-q" className="label">
            Search
          </label>
          <Input id="user-q" name="q" defaultValue={q} placeholder="Name, email or phone" />
        </div>
        <div>
          <label htmlFor="user-status" className="label">
            Status
          </label>
          <Select id="user-status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_EMAIL_VERIFICATION">Pending verification</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DELETED">Deleted</option>
          </Select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply filters
        </button>
        <Link href="/admin/users" className="btn-ghost">
          Reset
        </Link>
      </form>

      {data.items.length > 0 ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th>Plan</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr key={user.id}>
                      <td className="max-w-xs">
                        <p className="font-semibold text-navy-900">{user.fullName}</p>
                        <p className="text-xs text-ink-500">{user.email}</p>
                        <p className="text-[11px] text-ink-500">
                          {user.phone ?? "No phone"} · last sign-in {formatDateTimePkt(user.lastLoginAt)}
                        </p>
                      </td>
                      <td>
                        <Badge tone={statusTone[user.status] ?? "slate"}>
                          {user.status.replaceAll("_", " ").toLowerCase()}
                        </Badge>
                        {!user.emailVerified ? (
                          <span className="mt-1 block text-[11px] text-ink-500">Email unverified</span>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0
                            ? user.roles.map((role) => (
                                <Badge key={role} tone="navy">
                                  {role.replaceAll("_", " ")}
                                </Badge>
                              ))
                            : "—"}
                        </div>
                      </td>
                      <td className="text-xs">{user.plan ?? "Free"}</td>
                      <td className="whitespace-nowrap text-xs">{formatDatePkt(user.createdAt)}</td>
                      <td>
                        {isSelf ? (
                          <span className="text-xs text-ink-500">Current account</span>
                        ) : user.status === "SUSPENDED" ? (
                          <ActionButton action={updateUserStatus.bind(null, user.id, "ACTIVE")}>
                            Reactivate
                          </ActionButton>
                        ) : (
                          <ActionButton
                            action={updateUserStatus.bind(null, user.id, "SUSPENDED")}
                            variant="danger"
                            confirm={`Suspend ${user.email}? Active sessions will be revoked.`}
                          >
                            Suspend
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} basePath="/admin/users" searchParams={{ q, status }} />
        </>
      ) : (
        <EmptyState title="No users found" description="Adjust the search or status filter." />
      )}
    </div>
  );
}
