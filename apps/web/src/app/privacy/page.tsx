import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Pak Tenders collects, uses, stores and protects personal information.",
  alternates: { canonical: "/privacy" },
};

const updated = "November 2026";

export default function PrivacyPage() {
  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/privacy", label: "Privacy" }]} />
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Privacy policy</h1>
        <p className="mt-2 text-xs text-ink-500">Last updated: {updated}</p>

        <div className="prose-pak mt-6">
          <p>
            This policy explains what information Pak Tenders collects, why we collect it, and the
            choices you have. It applies to the website and the mobile applications. Contact{" "}
            <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> with any
            privacy question.
          </p>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> name, email address, optional phone number and
              password (stored only as a one-way hash).
            </li>
            <li>
              <strong>Profile and preferences:</strong> job title, province, city, preferred keywords,
              language and notification settings.
            </li>
            <li>
              <strong>Activity:</strong> saved tenders, saved searches, alert rules, in-app
              notifications and tender view counts.
            </li>
            <li>
              <strong>Session data:</strong> hashed refresh tokens, device/user-agent and IP address
              used for security and session management.
            </li>
            <li>
              <strong>Support correspondence:</strong> messages you send to support and the tender
              references you include.
            </li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To create and secure your account and keep you signed in.</li>
            <li>To show saved tenders, saved searches, alerts and notifications.</li>
            <li>To operate subscriptions, invoices and entitlements.</li>
            <li>To investigate abuse, errors and security incidents.</li>
            <li>To send service messages. Marketing messages require opt-in.</li>
          </ul>

          <h2>Cookies and local storage</h2>
          <p>
            The website uses two httpOnly cookies for authentication: a short-lived access token and
            a rotating refresh token. They are required to stay signed in and are not used for
            advertising. Analytics and advertising scripts are not enabled unless configured by the
            operator, in which case this policy will be updated.
          </p>

          <h2>Sharing</h2>
          <p>
            We do not sell personal information. Data is shared only with service providers needed to
            run the platform (for example hosting, email delivery or payment processing) and with
            authorities where required by law. Those providers are configured by the operator and are
            listed in the admin control center.
          </p>

          <h2>Retention</h2>
          <p>
            Account data is kept while the account is active. When you delete your account, direct
            identifiers are anonymised and sessions are revoked. Invoices, payment records and audit
            logs may be retained where required for accounting, fraud prevention or legal
            obligations.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>Update profile details and notification preferences from the dashboard.</li>
            <li>Delete saved tenders, saved searches and alert rules at any time.</li>
            <li>Delete your account from Dashboard → Profile → Danger zone.</li>
            <li>Email us to request access, correction or deletion of other data.</li>
          </ul>

          <h2>Security</h2>
          <p>
            Passwords are hashed, refresh tokens are stored as hashes, and access tokens are held in
            httpOnly cookies. Administrative actions are logged. No system is perfectly secure; use a
            unique password and contact us immediately if you suspect unauthorised access.
          </p>

          <h2>Children</h2>
          <p>
            The platform is intended for businesses and professionals and is not directed at children
            under 18.
          </p>

          <h2>Changes</h2>
          <p>
            We may update this policy as the platform evolves. Material changes will be announced on
            the site. The &ldquo;last updated&rdquo; date above shows the current version.
          </p>

          <p>
            See also our <Link href="/terms">terms of service</Link> and{" "}
            <Link href="/disclaimer">disclaimer</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
