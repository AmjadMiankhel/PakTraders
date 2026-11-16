import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  CircleDollarSign,
  ExternalLink,
  Eye,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from "lucide-react";
import type { TenderDetail } from "@paktenders/shared-types";
import { formatDatePkt, formatDateTimePkt, formatPkr, relativeDeadline, truncate } from "@paktenders/shared-utils";
import { Badge, TenderStatusBadge, TenderTypeBadge, VerificationBadge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Alert } from "@/components/ui/feedback";
import { TenderCard } from "@/components/tenders/tender-card";
import { SaveTenderButton } from "@/components/tenders/save-button";
import { PrintButton } from "@/components/tenders/print-button";
import { ApiError } from "@/lib/server-api";
import { getTenderBySlug, getSimilarTenders } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

async function loadTender(slug: string): Promise<TenderDetail> {
  try {
    return await getTenderBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tender = await loadTender(slug);
    const description = truncate(tender.summary ?? tender.description, 155);
    return {
      title: tender.title,
      description,
      alternates: { canonical: `/tenders/${tender.slug}` },
      robots:
        tender.verificationStatus === "DEMO"
          ? { index: false, follow: true }
          : { index: true, follow: true },
      openGraph: {
        type: "article",
        title: tender.title,
        description,
        publishedTime: tender.publishedAt ?? undefined,
        modifiedTime: tender.updatedAt,
      },
    };
  } catch {
    return { title: "Tender not found", robots: { index: false, follow: false } };
  }
}

export default async function TenderDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [tender, user] = await Promise.all([loadTender(slug), getCurrentUser()]);
  const similar = await getSimilarTenders(slug, 3).catch(() => []);

  const isDemo = tender.verificationStatus === "DEMO" || tender.isDemo;

  const facts: Array<{ label: string; value: React.ReactNode; icon: React.ReactNode }> = [
    {
      label: "Reference number",
      value: tender.referenceNumber ?? "Not provided",
      icon: <Hash className="h-4 w-4" />,
    },
    {
      label: "Department",
      value: (
        <Link href={`/departments/${tender.department.slug}`} className="font-medium text-emerald-700 hover:underline">
          {tender.department.name}
        </Link>
      ),
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      label: "Location",
      value: (
        <span>
          {tender.city ? `${tender.city.name}, ` : ""}
          <Link href={`/locations/${tender.province.slug}`} className="font-medium text-emerald-700 hover:underline">
            {tender.province.name}
          </Link>
        </span>
      ),
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      label: "Published",
      value: tender.publishedAt ? formatDatePkt(tender.publishedAt) : "Not published",
      icon: <CalendarPlus className="h-4 w-4" />,
    },
    {
      label: "Closing date",
      value: tender.closingAt ? (
        <span>
          {formatDateTimePkt(tender.closingAt)}
          <span className="block text-xs font-medium text-ink-500">{relativeDeadline(tender.closingAt)}</span>
        </span>
      ) : (
        "Not published"
      ),
      icon: <CalendarClock className="h-4 w-4" />,
    },
    {
      label: "Opening date",
      value: tender.openingAt ? formatDateTimePkt(tender.openingAt) : "Not published",
      icon: <Timer className="h-4 w-4" />,
    },
    {
      label: "Estimated value",
      value: formatPkr(tender.estimatedValue),
      icon: <CircleDollarSign className="h-4 w-4" />,
    },
    {
      label: "Bid security",
      value: tender.bidSecurityAmount ? formatPkr(tender.bidSecurityAmount) : "See tender documents",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: tender.title,
    description: tender.summary ?? tender.description,
    url: `${siteConfig.url}/tenders/${tender.slug}`,
    datePublished: tender.publishedAt ?? undefined,
    dateModified: tender.updatedAt,
    inLanguage: "en-PK",
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
    provider: { "@type": "GovernmentOrganization", name: tender.department.name },
  };

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs
        items={[
          { href: "/tenders", label: "Tenders" },
          { href: `/categories/${tender.category.slug}`, label: tender.category.name },
          { label: truncate(tender.title, 60) },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TenderTypeBadge type={tender.tenderType} />
            <TenderStatusBadge status={tender.status} />
            <VerificationBadge status={tender.verificationStatus} />
            {tender.isFeatured ? <Badge tone="amber">Featured</Badge> : null}
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-navy-900 sm:text-3xl">
            {tender.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">
            <Link href={`/categories/${tender.category.slug}`} className="font-semibold text-emerald-700 hover:underline">
              {tender.category.name}
            </Link>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {tender.viewCount.toLocaleString("en-PK")} views
            </span>
            <span>Updated {formatDatePkt(tender.updatedAt)}</span>
          </div>

          {isDemo ? (
            <Alert tone="warning" className="mt-5" title="This is a demo record">
              {tender.sourceAttribution ??
                "This tender is sample data created for product evaluation and is not a real procurement notice."}{" "}
              Do not use it for bidding or procurement decisions.
            </Alert>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2 no-print">
            <SaveTenderButton
              tenderId={tender.id}
              slug={tender.slug}
              isSaved={Boolean(tender.isSaved)}
              isAuthenticated={Boolean(user)}
            />
            <PrintButton />
            {tender.originalUrl ? (
              <a
                href={tender.originalUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn-secondary px-3 py-2 text-xs"
              >
                <ExternalLink className="h-4 w-4" /> Original notice
              </a>
            ) : null}
          </div>

          <section className="mt-8 border-t border-line pt-8">
            <h2 className="text-lg font-bold text-navy-900">Tender description</h2>
            <div className="prose-pak mt-3 whitespace-pre-line">{tender.description}</div>
          </section>

          {tender.eligibility ? (
            <section className="mt-8 border-t border-line pt-8">
              <h2 className="text-lg font-bold text-navy-900">Eligibility criteria</h2>
              <div className="prose-pak mt-3 whitespace-pre-line">{tender.eligibility}</div>
            </section>
          ) : null}

          {tender.requiredDocuments.length > 0 ? (
            <section className="mt-8 border-t border-line pt-8">
              <h2 className="text-lg font-bold text-navy-900">Required documents</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {tender.requiredDocuments.map((document) => (
                  <li key={document} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-700">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {document}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tender.bidSecurityDetails ? (
            <section className="mt-8 border-t border-line pt-8">
              <h2 className="text-lg font-bold text-navy-900">Bid security</h2>
              <p className="prose-pak mt-3 whitespace-pre-line">{tender.bidSecurityDetails}</p>
            </section>
          ) : null}

          {tender.documents.length > 0 ? (
            <section className="mt-8 border-t border-line pt-8">
              <h2 className="text-lg font-bold text-navy-900">Documents</h2>
              <ul className="mt-3 space-y-2">
                {tender.documents.map((document) => (
                  <li key={document.id}>
                    <a
                      href={document.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm hover:border-navy-200 hover:bg-surface"
                    >
                      <span className="flex items-center gap-2 font-medium text-navy-900">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        {document.title}
                      </span>
                      <span className="text-xs text-ink-500">
                        {document.mimeType ?? document.type}
                        {document.fileSize ? ` · ${Math.round(document.fileSize / 1024)} KB` : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tender.updates.length > 0 ? (
            <section className="mt-8 border-t border-line pt-8">
              <h2 className="text-lg font-bold text-navy-900">Tender updates</h2>
              <ol className="mt-3 space-y-4 border-l-2 border-emerald-200 pl-4">
                {tender.updates.map((update) => (
                  <li key={update.id}>
                    <p className="text-xs font-semibold text-emerald-700">
                      {formatDateTimePkt(update.publishedAt)} · {update.updateType.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-navy-900">{update.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-600">{update.body}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="mt-8 border-t border-line pt-8">
            <h2 className="text-lg font-bold text-navy-900">Contact &amp; source</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4 text-sm">
                <p className="font-semibold text-navy-900">Issuing department</p>
                <p className="mt-1 text-ink-600">{tender.department.name}</p>
                {tender.contactName ? <p className="mt-2 text-ink-600">Contact: {tender.contactName}</p> : null}
                {tender.contactEmail ? (
                  <a href={`mailto:${tender.contactEmail}`} className="mt-2 flex items-center gap-2 text-emerald-700 hover:underline">
                    <Mail className="h-4 w-4" /> {tender.contactEmail}
                  </a>
                ) : null}
                {tender.contactPhone ? (
                  <a href={`tel:${tender.contactPhone.replace(/\s+/g, "")}`} className="mt-2 flex items-center gap-2 text-emerald-700 hover:underline">
                    <Phone className="h-4 w-4" /> {tender.contactPhone}
                  </a>
                ) : null}
                {tender.contactAddress ? <p className="mt-2 text-ink-600">{tender.contactAddress}</p> : null}
                <Link href={`/departments/${tender.department.slug}`} className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">
                  View department profile →
                </Link>
              </div>
              <div className="rounded-xl border border-line p-4 text-sm">
                <p className="font-semibold text-navy-900">Source attribution</p>
                {tender.source ? (
                  <>
                    <p className="mt-1 text-ink-600">{tender.source.name}</p>
                    {tender.source.url ? (
                      <a
                        href={tender.source.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-2 inline-flex items-center gap-2 text-emerald-700 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" /> Visit source
                      </a>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-ink-500">No source recorded for this tender.</p>
                )}
                {tender.sourceAttribution ? (
                  <p className="mt-2 text-xs leading-5 text-ink-500">{tender.sourceAttribution}</p>
                ) : null}
                <a
                  href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent(`Report tender ${tender.referenceNumber ?? tender.slug}`)}`}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-red-600"
                >
                  <ShieldAlert className="h-3.5 w-3.5" /> Report incorrect information
                </a>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-navy-900">Tender summary</h2>
            <dl className="mt-4 space-y-4">
              {facts.map((fact) => (
                <div key={fact.label} className="flex gap-3">
                  <span className="mt-0.5 text-navy-400">{fact.icon}</span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      {fact.label}
                    </dt>
                    <dd className="mt-0.5 text-sm text-ink-800">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <p className="font-semibold">Verify before you bid</p>
            <p className="mt-1">
              Tender details can change after publication. Always confirm requirements, deadlines and
              bid security with the issuing department or the original notice.
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-semibold text-navy-900">Need tender alerts?</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              Create a free account to save this tender and receive in-app notifications.
            </p>
            <Link href={user ? "/dashboard/alerts" : "/register"} className="btn-primary mt-3 w-full">
              {user ? "Create an alert" : "Create free account"}
            </Link>
          </div>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="mt-14 border-t border-line pt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-navy-900">Similar tenders</h2>
              <p className="mt-1 text-sm text-ink-500">Related opportunities in the same category or province.</p>
            </div>
            <Link href={`/categories/${tender.category.slug}`} className="text-sm font-semibold text-emerald-700 hover:underline">
              More in {tender.category.name} →
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => (
              <TenderCard key={item.id} tender={item} />
            ))}
          </div>
        </section>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
