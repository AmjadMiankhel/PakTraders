import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Database, Eye, ShieldCheck, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SectionHeading } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Pak Tenders",
  description:
    "Pak Tenders is a procurement opportunities and tender intelligence platform built for Pakistani businesses, contractors and suppliers.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/about", label: "About" }]} />

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">About the platform</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            Procurement intelligence, built for Pakistan
          </h1>
          <div className="prose-pak mt-5">
            <p>
              Pak Tenders brings public and private procurement notices into one searchable
              directory. Instead of checking dozens of department websites and newspapers, you can
              search by sector, location, department and closing date — and keep the opportunities
              you care about in a single account.
            </p>
            <p>
              The platform is designed around the realities of Pakistani procurement: PKR values,
              Pakistan Standard Time deadlines, provincial and district coverage, and the need to
              verify every notice against its original source before bidding.
            </p>
            <h2>What you can do</h2>
            <ul>
              <li>Search published tenders by keyword, category, province, city and department.</li>
              <li>Review eligibility, bid security, required documents and source attribution.</li>
              <li>Save tenders and saved searches to your account across web and mobile.</li>
              <li>Create alert rules so new matching opportunities are surfaced to you.</li>
              <li>Follow departments and locations to understand where work is being published.</li>
            </ul>
            <h2>Data sourcing and verification</h2>
            <p>
              Tender records include a source field and an attribution note. Verification status is
              shown on every listing: <strong>Verified</strong>, <strong>Pending</strong>,{" "}
              <strong>Unverified</strong> or <strong>Demo</strong>. A verified record means an
              administrator has reviewed the source; it is not a guarantee that the notice is still
              current or that the issuing department will accept your bid.
            </p>
            <p>
              Demo records are sample data used to evaluate the product. They are clearly labelled
              throughout the site and are excluded from search-engine indexing.
            </p>
            <h2>Who it is for</h2>
            <p>
              Contractors, suppliers, consultants, manufacturers, distributors, NGOs and service
              providers who want a faster way to find and track procurement opportunities. The
              platform is English-first and structured so Urdu localisation can be added without
              changing the data model.
            </p>
            <h2>What we do not do</h2>
            <p>
              Pak Tenders does not bid on your behalf, does not guarantee tender authenticity, and
              does not replace the official tender documents. Always confirm requirements, deadlines
              and payment terms with the issuing department.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-navy-900">Platform principles</h2>
            <ul className="mt-4 space-y-3 text-sm text-ink-600">
              {[
                { icon: <Database className="h-4 w-4" />, text: "Live database counts — no invented statistics." },
                { icon: <Eye className="h-4 w-4" />, text: "Demo and unverified records are labelled, never hidden." },
                { icon: <ShieldCheck className="h-4 w-4" />, text: "Every record links to its source and attribution." },
                { icon: <Users className="h-4 w-4" />, text: "Built for individuals, teams and organisations." },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-600">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-navy-950 p-5 text-white">
            <h2 className="text-sm font-bold">Talk to the team</h2>
            <p className="mt-1 text-xs leading-5 text-white/60">
              Questions about coverage, plans or partnerships? Email{" "}
              <a href={`mailto:${siteConfig.supportEmail}`} className="font-semibold text-emerald-300 hover:underline">
                {siteConfig.supportEmail}
              </a>
              .
            </p>
            <ButtonLink href="/contact" className="mt-4 w-full" variant="secondary">
              Contact support
            </ButtonLink>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Ready to start?
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              The Free plan requires no payment details.
            </p>
            <Link href="/register" className="btn-primary mt-3 w-full">
              Create free account
            </Link>
          </div>
        </aside>
      </div>

      <section className="mt-16">
        <SectionHeading
          eyebrow="How we work"
          title="A clear process from source to listing"
          description="Every record passes through the same structure so you can judge it quickly."
          align="center"
        />
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { step: "01", title: "Collect", body: "Notices are added from department sources, newspapers and partner feeds." },
            { step: "02", title: "Structure", body: "Category, department, location, value, deadlines and documents are normalised." },
            { step: "03", title: "Verify", body: "A verification status is recorded and the source attribution is attached." },
            { step: "04", title: "Publish", body: "The tender becomes searchable and can be saved or tracked by users." },
          ].map((item) => (
            <div key={item.step} className="card p-5">
              <p className="text-xs font-bold text-emerald-700">{item.step}</p>
              <h3 className="mt-2 text-sm font-semibold text-navy-900">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
