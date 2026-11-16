import type { Metadata } from "next";
import type { ProvinceDto } from "@paktenders/shared-types";
import { formatDatePkt, formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PreferencesForm } from "@/components/dashboard/preferences-form";
import { DeleteAccountForm } from "@/components/dashboard/delete-account-form";
import { apiFetchAuthed, apiFetchSafe } from "@/lib/server-api";
import type { MyProfile } from "@/lib/account-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile & preferences",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const [profile, provinces] = await Promise.all([
    apiFetchAuthed<MyProfile | null>("/v1/me/profile", null),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
  ]);

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Profile</h1>
        <Alert tone="error">
          Your profile could not be loaded. Refresh the page or sign in again.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Profile & preferences</h1>
        <p className="mt-1 text-sm text-ink-500">
          Keep your contact details current and choose how you want to be notified.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-base font-bold text-navy-900">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email</dt>
            <dd className="mt-1 break-all text-ink-800">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Status</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone={profile.status === "ACTIVE" ? "green" : "amber"}>{profile.status}</Badge>
              {profile.emailVerified ? (
                <Badge tone="green">Email verified</Badge>
              ) : (
                <Badge tone="slate">Email not verified</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Member since</dt>
            <dd className="mt-1 text-ink-800">{formatDatePkt(profile.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Last sign-in</dt>
            <dd className="mt-1 text-ink-800">{formatDateTimePkt(profile.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Plan</dt>
            <dd className="mt-1 text-ink-800">{profile.subscription?.planName ?? "Free"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Roles</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {profile.roles.length > 0
                ? profile.roles.map((role) => (
                    <Badge key={role} tone="navy">
                      {role.replaceAll("_", " ")}
                    </Badge>
                  ))
                : "—"}
            </dd>
          </div>
        </dl>
        {!profile.emailVerified ? (
          <Alert tone="info" className="mt-4">
            Email verification is not enforced because no email provider is configured in this
            environment. Your account is active; verification will be enabled once email delivery is
            configured.
          </Alert>
        ) : null}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-navy-900">Profile details</h2>
        <p className="mt-1 text-sm text-ink-500">
          These details help personalize your alerts and are never shown publicly.
        </p>
        <div className="mt-5">
          <ProfileForm profile={profile} provinces={provinces} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-navy-900">Notification preferences</h2>
        <div className="mt-4">
          <PreferencesForm profile={profile} />
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
        <h2 className="text-base font-bold text-red-800">Delete account</h2>
        <p className="mt-1 text-sm leading-6 text-red-700">
          This permanently removes your profile, saved tenders and sessions. Records required for
          accounting and audit (such as invoices) are retained. This action cannot be undone.
        </p>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
