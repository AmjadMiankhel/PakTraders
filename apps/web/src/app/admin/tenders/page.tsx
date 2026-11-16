import type { Metadata } from "next";
import Link from "next/link";
import { formatDatePkt } from "@paktenders/shared-utils";
import { ActionButton } from "@/components/forms/action-button";
import { Badge, TenderStatusBadge, VerificationBadge } from "@/components/ui/badge";
import { EmptyState, Pagination } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { apiFetchAuthed } from "@/lib/server-api";
import { deleteTender, setTenderStatus, verifyTender } from "@/lib/actions";
import type { AdminTendersResponse } from "@/lib/admin-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage tenders",
  robots: { index: false, follow: false },
};

const empty: AdminTendersResponse = {
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

export default async function AdminTendersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const q = firstValue(params.q) ?? "";
  const status = firstValue(params.status) ?? "";
  const verificationStatus = firstValue(params.verificationStatus) ?? "";

  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (q.trim()) query.set("q", q.trim());
  if (status) query.set("status", status);
  if (verificationStatus) query.set("verificationStatus", verificationStatus);

  const data = await apiFetchAuthed<AdminTendersResponse>(
    `/v1/admin/tenders?${query.toString()}`,
    empty,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Tenders</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data.meta.total.toLocaleString("en-PK")} record{data.meta.total === 1 ? "" : "s"} across
            every status. Changes are audited.
          </p>
        </div>
        <Link href="/admin/tenders/new" className="btn-primary">
          Create tender
        </Link>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-48 flex-1">
          <label htmlFor="admin-q" className="label">
            Search
          </label>
          <Input id="admin-q" name="q" defaultValue={q} placeholder="Title, reference number…" />
        </div>
        <div>
          <label htmlFor="admin-status" className="label">
            Status
          </label>
          <Select id="admin-status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
            <option value="PUBLISHED">Published</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
        <div>
          <label htmlFor="admin-verification" className="label">
            Verification
          </label>
          <Select id="admin-verification" name="verificationStatus" defaultValue={verificationStatus}>
            <option value="">All</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="DEMO">Demo</option>
          </Select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply filters
        </button>
        <Link href="/admin/tenders" className="btn-ghost">
          Reset
        </Link>
      </form>

      {data.items.length > 0 ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Closing</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((tender) => (
                  <tr key={tender.id}>
                    <td className="max-w-md">
                      <Link href={`/admin/tenders/${tender.id}`} className="font-semibold text-navy-900 hover:text-emerald-700">
                        {tender.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {tender.referenceNumber ?? "No reference"} · {tender.category.name} ·{" "}
                        {tender.province.name}
                      </p>
                      {tender.isDemo ? (
                        <span className="mt-1 inline-block">
                          <Badge tone="purple">Demo</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <TenderStatusBadge status={tender.status} />
                    </td>
                    <td>
                      <VerificationBadge status={tender.verificationStatus} />
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDatePkt(tender.closingAt)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {tender.status !== "PUBLISHED" ? (
                          <ActionButton action={setTenderStatus.bind(null, tender.id, "PUBLISHED")} variant="primary">
                            Publish
                          </ActionButton>
                        ) : (
                          <ActionButton action={setTenderStatus.bind(null, tender.id, "CLOSED")}>
                            Close
                          </ActionButton>
                        )}
                        {tender.verificationStatus !== "VERIFIED" ? (
                          <ActionButton action={verifyTender.bind(null, tender.id, "VERIFIED")}>
                            Verify
                          </ActionButton>
                        ) : null}
                        <ActionButton
                          action={deleteTender.bind(null, tender.id)}
                          variant="danger"
                          confirm="Soft-delete this tender? It will disappear from public pages."
                        >
                          Delete
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={data.meta}
            basePath="/admin/tenders"
            searchParams={{ q, status, verificationStatus }}
          />
        </>
      ) : (
        <EmptyState
          title="No tenders found"
          description="Adjust the filters, or create the first tender record."
          action={
            <Link href="/admin/tenders/new" className="btn-primary">
              Create tender
            </Link>
          }
        />
      )}
    </div>
  );
}
