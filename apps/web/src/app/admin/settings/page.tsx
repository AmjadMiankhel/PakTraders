import type { Metadata } from "next";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/forms/action-form";
import { FormRow, Textarea } from "@/components/ui/field";
import { apiFetchAuthed } from "@/lib/server-api";
import { updateSetting } from "@/lib/actions";
import type { AdminSetting } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform settings",
  robots: { index: false, follow: false },
};

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return JSON.stringify(value, null, 2);
}

export default async function AdminSettingsPage() {
  const settings = await apiFetchAuthed<AdminSetting[]>("/v1/admin/settings", []);
  const publicSettings = settings.filter((setting) => setting.isPublic);
  const privateSettings = settings.filter((setting) => !setting.isPublic);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Platform settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Values are stored as JSON. Public settings are exposed to the website through{" "}
          <code>GET /v1/settings/public</code>; secrets never belong here.
        </p>
      </div>

      <Alert tone="info">
        Edit values as valid JSON. A plain string must be quoted, for example{" "}
        <code>&quot;New announcement&quot;</code>. Booleans use <code>true</code> or{" "}
        <code>false</code>. Every change is written to the audit log.
      </Alert>

      <SettingGroup title="Public settings" settings={publicSettings} />
      <SettingGroup title="Private settings" settings={privateSettings} />

      {settings.length === 0 ? (
        <p className="text-sm text-ink-500">No settings were returned by the API.</p>
      ) : null}
    </div>
  );
}

function SettingGroup({ title, settings }: { title: string; settings: AdminSetting[] }) {
  if (settings.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-navy-900">{title}</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {settings.map((setting) => (
          <div key={setting.key} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="rounded bg-surface px-2 py-1 text-xs font-semibold text-navy-800">
                {setting.key}
              </code>
              <Badge tone={setting.isPublic ? "green" : "slate"}>
                {setting.isPublic ? "Public" : "Private"}
              </Badge>
            </div>
            {setting.description ? (
              <p className="mt-2 text-xs leading-5 text-ink-500">{setting.description}</p>
            ) : null}
            <p className="mt-1 text-[11px] text-ink-500">
              Updated {formatDateTimePkt(setting.updatedAt)}
            </p>
            <ActionForm action={updateSetting} submitLabel="Save" className="mt-3" successMessage="Setting saved">
              <input type="hidden" name="key" value={setting.key} />
              <FormRow label="Value (JSON)" htmlFor={`setting-${setting.key}`}>
                <Textarea
                  id={`setting-${setting.key}`}
                  name="value"
                  defaultValue={formatValue(setting.value)}
                  className="min-h-24 font-mono text-xs"
                  spellCheck={false}
                />
              </FormRow>
            </ActionForm>
          </div>
        ))}
      </div>
    </section>
  );
}
