"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/feedback";
import { FormRow, Select } from "@/components/ui/field";
import { updatePreferences } from "@/lib/actions";
import type { MyProfile } from "@/lib/account-types";

export function PreferencesForm({ profile }: { profile: MyProfile }) {
  const pref = profile.preference;
  const notif = profile.notificationPreferences;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        In-app notifications are always delivered. Email, push, WhatsApp and SMS need an
        administrator to configure the corresponding provider before they can send.
      </Alert>
      <ActionForm
        action={updatePreferences}
        submitLabel="Save preferences"
        successMessage="Notification preferences updated"
      >
        <FormRow label="Language" htmlFor="pref-language" hint="Urdu interface support is being rolled out.">
          <Select id="pref-language" name="language" defaultValue={pref?.language ?? "en"}>
            <option value="en">English</option>
            <option value="ur">Urdu</option>
          </Select>
        </FormRow>

        <fieldset>
          <legend className="label">Notification channels</legend>
          <div className="space-y-2 text-sm text-ink-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emailEnabled"
                defaultChecked={notif?.emailEnabled ?? pref?.emailEnabled ?? true}
                className="h-4 w-4 rounded border-line"
              />
              Email notifications
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="pushEnabled"
                defaultChecked={notif?.pushEnabled ?? pref?.pushEnabled ?? true}
                className="h-4 w-4 rounded border-line"
              />
              Push notifications (mobile app)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="whatsappEnabled"
                defaultChecked={notif?.whatsappEnabled ?? false}
                className="h-4 w-4 rounded border-line"
              />
              WhatsApp messages
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="smsEnabled"
                defaultChecked={notif?.smsEnabled ?? false}
                className="h-4 w-4 rounded border-line"
              />
              SMS messages
            </label>
          </div>
        </fieldset>

        <FormRow label="Digest frequency" htmlFor="pref-digest">
          <Select id="pref-digest" name="digestFrequency" defaultValue={notif?.digestFrequency ?? "DAILY"}>
            <option value="INSTANT">Instant</option>
            <option value="DAILY">Daily digest</option>
            <option value="WEEKLY">Weekly digest</option>
          </Select>
        </FormRow>
      </ActionForm>
    </div>
  );
}
