import type { Metadata } from "next";
import Link from "next/link";
import { Check, CreditCard } from "lucide-react";
import { formatDatePkt, formatPkr } from "@paktenders/shared-utils";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { apiFetchAuthed } from "@/lib/server-api";
import type { InvoiceDto, MySubscription } from "@/lib/account-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription & invoices",
  robots: { index: false, follow: false },
};

export default async function SubscriptionPage() {
  const [subscription, invoices] = await Promise.all([
    apiFetchAuthed<MySubscription | null>("/v1/me/subscription", null),
    apiFetchAuthed<InvoiceDto[]>("/v1/me/invoices", []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Subscription & invoices</h1>
        <p className="mt-1 text-sm text-ink-500">
          Review your current plan, entitlements and invoice history.
        </p>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current plan</p>
            <h2 className="mt-1 text-xl font-bold text-navy-900">
              {subscription?.plan.name ?? "Free"}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {subscription
                ? `${formatPkr(subscription.plan.pricePkr)} per ${subscription.plan.interval === "YEAR" ? "year" : "month"}`
                : "No paid subscription is active on this account."}
            </p>
          </div>
          <Badge tone={subscription?.status === "ACTIVE" ? "green" : "slate"}>
            {subscription?.status ?? "FREE"}
          </Badge>
        </div>

        {subscription ? (
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Started</p>
              <p className="mt-1 text-ink-800">{formatDatePkt(subscription.startsAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Ends</p>
              <p className="mt-1 text-ink-800">{formatDatePkt(subscription.endsAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Auto-renew</p>
              <p className="mt-1 text-ink-800">{subscription.autoRenew ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
        ) : (
          <Alert tone="info" className="mt-5">
            Online payment gateways are not configured yet, so paid plans cannot be purchased on the
            website. Contact support to arrange activation.
          </Alert>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/pricing" className="btn-secondary">
            Compare plans
          </Link>
          <a href="mailto:support@paktenders.pk?subject=Subscription%20enquiry" className="btn-ghost">
            Contact support
          </a>
        </div>
      </section>

      {subscription ? (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-navy-900">
            <CreditCard className="h-4 w-4 text-emerald-600" /> Plan features
          </h2>
          <ul className="mt-4 grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
            {Object.entries(subscription.plan.features ?? {}).map(([key, value]) => (
              <li key={key} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="font-medium text-ink-700">{key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}:</span>{" "}
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Invoices</h2>
        </div>
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Issued</th>
                  <th>Total</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-medium text-navy-900">{invoice.number}</td>
                    <td>{formatDatePkt(invoice.issuedAt)}</td>
                    <td className="tabular-nums">{formatPkr(invoice.total)}</td>
                    <td>
                      {invoice.pdfUrl ? (
                        <a href={invoice.pdfUrl} className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer">
                          Download
                        </a>
                      ) : (
                        <span className="text-ink-500">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-ink-500">No invoices yet.</p>
        )}
      </section>
    </div>
  );
}
