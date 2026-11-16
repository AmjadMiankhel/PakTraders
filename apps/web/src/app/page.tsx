import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type {
  CategoryDto,
  Paginated,
  PlatformStats,
  ProvinceDto,
  TenderSummary,
} from "@paktenders/shared-types";
import { formatPkrCompact } from "@paktenders/shared-utils";
import { HeroSearch } from "@/components/home/hero-search";
import { TenderCard } from "@/components/tenders/tender-card";
import { CategoryIcon } from "@/components/category-icon";
import { DemoNotice } from "@/components/demo-notice";
import { SectionHeading, StatTile } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { apiFetchSafe } from "@/lib/server-api";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

const emptyPage: Paginated<TenderSummary> = {
  items: [],
  meta: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
};

export default async function HomePage() {
  const [stats, latest, closingSoon, categories, provinces] = await Promise.all([
    apiFetchSafe<PlatformStats | null>("/v1/stats", null),
    apiFetchSafe<Paginated<TenderSummary>>("/v1/tenders?pageSize=6&sort=newest", emptyPage),
    apiFetchSafe<Paginated<TenderSummary>>(
      "/v1/tenders?pageSize=4&sort=closing&closingWithinDays=14",
      { ...emptyPage, meta: { ...emptyPage.meta, pageSize: 4 } },
    ),
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
  ]);

  const topCategories = [...categories]
    .sort((a, b) => b.tenderCount - a.tenderCount || a.name.localeCompare(b.name))
    .slice(0, 10);

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pak Tenders",
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/tenders?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <section className="relative overflow-hidden bg-navy-950">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(1200px 500px at 15% -10%, rgba(5,150,105,0.35), transparent 60%), radial-gradient(900px 400px at 95% 10%, rgba(36,71,124,0.65), transparent 60%), linear-gradient(160deg, #061224 0%, #0A1B36 55%, #065F46 130%)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden="true">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>

        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pakistan&apos;s procurement intelligence platform
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find the right tender.
              <span className="block text-emerald-300">Bid with confidence.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Search government, private, NGO and consultancy opportunities across Pakistan. Track
              closing dates, follow the departments that matter, and keep every bid deadline in one
              place.
            </p>
          </div>

          <div className="mt-8 max-w-4xl">
            <HeroSearch categories={categories} provinces={provinces} />
          </div>

          <dl className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-white/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <dt className="sr-only">Live database</dt>
              <dd>Live database counts</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <dt className="sr-only">Coverage</dt>
              <dd>All provinces &amp; territories</dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-emerald-400" />
              <dt className="sr-only">Timezone</dt>
              <dd>Deadlines in PKT (UTC+5)</dd>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">Rs</span>
              <dt className="sr-only">Currency</dt>
              <dd>Values in PKR</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="container-page -mt-8 relative z-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Open tenders"
            value={stats ? stats.activeTenders.toLocaleString("en-PK") : "—"}
            hint="Published and accepting bids"
            icon={<FileSearch className="h-5 w-5" />}
          />
          <StatTile
            label="Closing within 7 days"
            value={stats ? stats.closingSoon.toLocaleString("en-PK") : "—"}
            hint="Deadlines to review now"
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <StatTile
            label="Categories"
            value={stats ? stats.categories.toLocaleString("en-PK") : "—"}
            hint="Sectors and procurement types"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatTile
            label="Departments"
            value={stats ? stats.departments.toLocaleString("en-PK") : "—"}
            hint="Public and private buyers"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </div>
        {stats && stats.demoRecords > 0 ? (
          <div className="mt-4">
            <DemoNotice count={stats.demoRecords} />
          </div>
        ) : null}
      </section>

      <section className="container-page py-16">
        <SectionHeading
          eyebrow="Latest opportunities"
          title="Recently published tenders"
          description="The newest notices in the directory, newest first. Every listing links to its source attribution and deadline."
          action={
            <ButtonLink href="/tenders" variant="secondary">
              View all tenders <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          }
        />
        {latest.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.items.map((tender) => (
              <TenderCard key={tender.id} tender={tender} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No tenders published yet"
            description="Once tender records are published they will appear here. Administrators can add the first record from the control center."
            action={<ButtonLink href="/admin/tenders">Open admin console</ButtonLink>}
            icon={<FileSearch className="h-10 w-10" />}
          />
        )}
      </section>

      {closingSoon.items.length > 0 ? (
        <section className="border-y border-line bg-surface py-16">
          <div className="container-page">
            <SectionHeading
              eyebrow="Deadline watch"
              title="Closing in the next 14 days"
              description="Tenders approaching their submission deadline. Check requirements and plan your bid early."
              action={
                <ButtonLink href="/tenders?closingWithinDays=14&sort=closing" variant="secondary">
                  See closing soon <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {closingSoon.items.map((tender) => (
                <TenderCard key={tender.id} tender={tender} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="container-page py-16">
        <SectionHeading
          eyebrow="Browse by sector"
          title="Procurement categories"
          description="From civil works and IT services to medical supplies, solar energy and consultancy assignments."
          action={
            <ButtonLink href="/categories" variant="secondary">
              All categories <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          }
        />
        {topCategories.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {topCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="card card-hover flex flex-col gap-3 p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <CategoryIcon name={category.icon} className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold leading-5 text-navy-900">{category.name}</span>
                <span className="mt-auto text-xs text-ink-500">
                  {category.tenderCount} open tender{category.tenderCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Categories are being configured" description="Category browsing becomes available once the catalogue is seeded." />
        )}
      </section>

      <section className="border-y border-line bg-navy-950 py-16 text-white">
        <div className="container-page">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
                Nationwide coverage
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Browse opportunities by location
              </h2>
              <p className="mt-2 text-[15px] leading-7 text-white/60">
                Federal, provincial and regional procurement — including AJK, Gilgit-Baltistan and
                Islamabad Capital Territory.
              </p>
            </div>
            <ButtonLink href="/locations" variant="secondary" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              All locations <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {provinces.map((province) => (
              <Link
                key={province.id}
                href={`/locations/${province.slug}`}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-400/40 hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{province.name}</span>
                  <MapPin className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="mt-2 text-xs text-white/50">
                  {province.tenderCount} tender{province.tenderCount === 1 ? "" : "s"} ·{" "}
                  {province.cities.length} cit{province.cities.length === 1 ? "y" : "ies"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <SectionHeading
          eyebrow="How it works"
          title="From notice to submission in three steps"
          align="center"
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <Search className="h-6 w-6" />,
              title: "Search and filter",
              body: "Filter by sector, province, department, tender type and closing window. Keyword search covers titles, reference numbers and descriptions.",
            },
            {
              icon: <BellRing className="h-6 w-6" />,
              title: "Track what matters",
              body: "Create an account to save tenders, keep saved searches and set alert rules for the opportunities you follow.",
            },
            {
              icon: <Sparkles className="h-6 w-6" />,
              title: "Prepare and bid",
              body: "Review eligibility, bid security and required documents, then verify every detail with the issuing department before submitting.",
            },
          ].map((step, index) => (
            <div key={step.title} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  {step.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-emerald-800 px-6 py-12 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Stop missing deadlines. Start tracking tenders properly.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/70">
            Create a free account to save tenders, keep searches and manage alert rules across web
            and mobile.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/register" size="lg">
              Create free account
            </ButtonLink>
            <Link
              href="/pricing"
              className="btn border border-white/20 bg-white/5 px-6 py-3 text-base text-white hover:bg-white/10"
            >
              Compare plans
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/40">
            No payment required for the Free plan. Paid plans are not activated until a payment
            gateway is configured.
          </p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </>
  );
}
