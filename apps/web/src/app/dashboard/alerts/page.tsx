import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { ActionForm } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/action-button";
import { Alert } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/states";
import { FormRow, Input, Select } from "@/components/ui/field";
import { apiFetchAuthed } from "@/lib/server-api";
import { createAlert, deleteAlert, toggleAlert } from "@/lib/actions";
import type { AlertRuleDto } from "@/lib/account-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alert rules",
  robots: { index: false, follow: false },
};

export default async function AlertsPage() {
  const alerts = await apiFetchAuthed<AlertRuleDto[]>("/v1/me/alerts", []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Alert rules</h1>
        <p className="mt-1 text-sm text-ink-500">
          Alerts match new tenders against a keyword and notify you in-app. Email, push, WhatsApp
          and SMS delivery become available when those integrations are configured.
        </p>
      </div>

      <Alert tone="info">
        In-app notifications work now. Other channels are stored with your rule but are not
        delivered until the corresponding provider is configured by an administrator.
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {alerts.length > 0 ? (
            <div className="card divide-y divide-line">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-navy-900">{alert.name}</p>
                      <span
                        className={
                          alert.isActive
                            ? "badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "badge bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }
                      >
                        {alert.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      Keyword:{" "}
                      {typeof alert.queryJson.q === "string" && alert.queryJson.q.trim()
                        ? alert.queryJson.q
                        : "any"}{" "}
                      · {alert.frequency.toLowerCase()} · {alert.channels.join(", ")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      Created {formatDateTimePkt(alert.createdAt)}
                      {alert.lastRunAt ? ` · Last run ${formatDateTimePkt(alert.lastRunAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActionButton
                      action={toggleAlert.bind(null, alert.id, !alert.isActive)}
                    >
                      {alert.isActive ? "Pause" : "Activate"}
                    </ActionButton>
                    <ActionButton
                      action={deleteAlert.bind(null, alert.id)}
                      variant="danger"
                      confirm="Delete this alert rule?"
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No alert rules"
              description="Create an alert to be notified when new tenders match your keywords."
              icon={<BellRing className="h-7 w-7" />}
            />
          )}
        </div>

        <section className="card h-fit p-5">
          <h2 className="text-base font-bold text-navy-900">Create an alert</h2>
          <ActionForm action={createAlert} submitLabel="Create alert" className="mt-4" successMessage="Alert created">
            <FormRow label="Alert name" htmlFor="alert-name">
              <Input id="alert-name" name="name" required minLength={2} maxLength={80} placeholder="e.g. IT tenders in Lahore" />
            </FormRow>
            <FormRow label="Keyword" htmlFor="alert-q" hint="Leave blank to match all new tenders.">
              <Input id="alert-q" name="q" placeholder="e.g. software" />
            </FormRow>
            <FormRow label="Frequency" htmlFor="alert-frequency">
              <Select id="alert-frequency" name="frequency" defaultValue="DAILY">
                <option value="INSTANT">Instant</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
              </Select>
            </FormRow>
            <fieldset>
              <legend className="label">Channels</legend>
              <div className="space-y-2 text-sm text-ink-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="channels" value="IN_APP" defaultChecked className="h-4 w-4 rounded border-line" />
                  In-app (works now)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="channels" value="EMAIL" className="h-4 w-4 rounded border-line" />
                  Email (requires provider)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="channels" value="PUSH" className="h-4 w-4 rounded border-line" />
                  Push (requires provider)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="channels" value="WHATSAPP" className="h-4 w-4 rounded border-line" />
                  WhatsApp (requires provider)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="channels" value="SMS" className="h-4 w-4 rounded border-line" />
                  SMS (requires provider)
                </label>
              </div>
            </fieldset>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
