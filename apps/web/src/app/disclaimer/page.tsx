import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Important information about tender accuracy, demo records and the limits of the Pak Tenders platform.",
  alternates: { canonical: "/disclaimer" },
};

export default function DisclaimerPage() {
  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/disclaimer", label: "Disclaimer" }]} />
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Disclaimer</h1>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Always verify a tender before bidding.</strong> Pak Tenders is an independent
            information platform. We do not issue tenders, evaluate bids or guarantee that a notice
            is current, complete or authentic.
          </p>
        </div>

        <div className="prose-pak mt-6">
          <h2>Independent aggregator</h2>
          <p>
            Tender notices are collected from public sources, newspapers, department websites and
            partner feeds. We structure them for search but do not control the underlying content.
            The issuing department&apos;s official documents are the authoritative source.
          </p>

          <h2>Demo records</h2>
          <p>
            Records marked <strong>Demo</strong> are sample data created for product evaluation. They
            are not real procurement notices, are excluded from search-engine indexing, and must
            never be used to prepare or submit a bid. Demo records can be removed by the platform
            operator.
          </p>

          <h2>Verification labels</h2>
          <p>
            <strong>Verified</strong> means an administrator has reviewed the record against its
            source at a point in time. <strong>Pending</strong> and <strong>Unverified</strong> mean
            no final review has been recorded. None of these labels is a warranty. Deadlines,
            eligibility and bid security can change after publication.
          </p>

          <h2>No professional advice</h2>
          <p>
            Nothing on the platform is legal, financial, tax or procurement advice. Consult a
            qualified professional and read the official tender documents before making decisions.
          </p>

          <h2>External links</h2>
          <p>
            Links to department websites and original notices are provided for convenience. We are
            not responsible for external content, availability or security.
          </p>

          <h2>Limitation</h2>
          <p>
            To the maximum extent permitted by law, Pak Tenders is not liable for any loss arising
            from reliance on information on the platform, including missed deadlines or unsuccessful
            bids. See our <Link href="/terms">terms of service</Link>.
          </p>

          <h2>Report a problem</h2>
          <p>
            Found an incorrect deadline, wrong department or a record that should be removed? Email{" "}
            <a href={`mailto:${siteConfig.supportEmail}?subject=Tender%20correction`}>
              {siteConfig.supportEmail}
            </a>{" "}
            with the tender reference and source URL. See also our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
