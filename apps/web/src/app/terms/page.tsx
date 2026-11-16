import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that govern use of the Pak Tenders website and mobile applications.",
  alternates: { canonical: "/terms" },
};

const updated = "November 2026";

export default function TermsPage() {
  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/terms", label: "Terms" }]} />
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Terms of service</h1>
        <p className="mt-2 text-xs text-ink-500">Last updated: {updated}</p>

        <div className="prose-pak mt-6">
          <p>
            These terms govern your use of Pak Tenders. By creating an account or using the platform,
            you agree to them. If you do not agree, do not use the service.
          </p>

          <h2>1. The service</h2>
          <p>
            Pak Tenders is an information platform that aggregates and structures procurement
            notices. We are not a procurement authority, do not issue tenders, and are not a party to
            any contract between you and an issuing department.
          </p>

          <h2>2. Accounts</h2>
          <ul>
            <li>You must provide accurate information and keep your password secure.</li>
            <li>You are responsible for activity under your account.</li>
            <li>One person or organisation may not create accounts to evade limits or suspensions.</li>
            <li>We may suspend accounts that breach these terms or present a security risk.</li>
          </ul>

          <h2>3. Tender information</h2>
          <p>
            Tender records may be incomplete, delayed or inaccurate. Verification labels describe our
            review process, not a guarantee. You must independently confirm every requirement,
            deadline, bid security and submission method with the issuing department before bidding.
            Demo records are sample data and must not be used for procurement decisions.
          </p>

          <h2>4. Acceptable use</h2>
          <ul>
            <li>Do not scrape, resell or redistribute the directory without written permission.</li>
            <li>Do not attempt to bypass access controls, rate limits or subscription limits.</li>
            <li>Do not upload malicious content or interfere with the platform.</li>
            <li>Do not use the service for unlawful, fraudulent or misleading purposes.</li>
          </ul>

          <h2>5. Plans and payments</h2>
          <p>
            Free features are available without payment. Paid plans require a configured payment
            gateway; where online payments are not enabled, paid plans cannot be purchased on the
            site. Prices are shown in PKR and may change with notice. Where a paid subscription is
            active, renewal and cancellation follow the terms shown at purchase.
          </p>

          <h2>6. Intellectual property</h2>
          <p>
            The platform, branding and original content are owned by Pak Tenders or its licensors.
            Tender notices remain the property of their issuing departments and are displayed with
            source attribution. You may use the service for your own business purposes only.
          </p>

          <h2>7. Availability</h2>
          <p>
            We aim to keep the service available but do not guarantee uninterrupted access. Features
            that depend on third-party providers (email, SMS, push, AI, payments) may be disabled
            until configured.
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Pak Tenders is not liable for lost bids, missed
            deadlines, lost profits or indirect losses arising from use of the service. Nothing in
            these terms excludes liability that cannot be excluded under applicable law.
          </p>

          <h2>9. Termination</h2>
          <p>
            You may stop using the service at any time and may delete your account from the
            dashboard. We may suspend or terminate access for breach of these terms.
          </p>

          <h2>10. Governing law</h2>
          <p>
            These terms are governed by the laws of Pakistan. Disputes are subject to the jurisdiction
            of the courts of Pakistan.
          </p>

          <h2>11. Contact</h2>
          <p>
            Questions about these terms:{" "}
            <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>. See also our{" "}
            <Link href="/privacy">privacy policy</Link> and <Link href="/disclaimer">disclaimer</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
