import type { Metadata } from "next";
import Link from "next/link";
import { Check, HelpCircle, Sparkles } from "lucide-react";
import type { SubscriptionPlanDto } from "@paktenders/shared-types";
import { formatPkr } from "@paktenders/shared-utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SectionHeading } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { apiFetchSafe } from "@/lib/server-api";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans & pricing",
  description:
    "Compare Pak Tenders plans for individuals, contractors and businesses. Start free, upgrade when you need more saved tenders, alerts and AI assistance.",
  alternates: { canonical: "/pricing" },
};

function featureList(plan: SubscriptionPlanDto): string[] {
  const features = (plan.features ?? {}) as Record<string, unknown>;
  const items: string[] = [];

  if (features.tenderBrowsing) items.push("Browse all published tenders");
  if (features.advancedFilters) items.push("Advanced search filters");
  if (typeof features.savedTenders === "number") items.push(`Save up to ${features.savedTenders} tenders`);
  if (features.savedTenders === "unlimited") items.push("Unlimited saved tenders");
  if (typeof features.alerts === "number") items.push(`${features.alerts} alert rule${features.alerts === 1 ? "" : "s"}`);
  if (features.emailAlerts) items.push("Email alerts");
  if (features.pushAlerts) items.push("Push notifications (mobile)");
  if (features.documentAssistant) items.push("Document assistant");
  if (features.exportData) items.push("Export data");
  if (typeof features.teamMembers === "number") items.push(`${features.teamMembers} team members`);
  if (plan.chatbotQuota > 0) items.push(`${plan.chatbotQuota} AI assistant messages / day`);

  const support = typeof features.support === "string" ? features.support : "community";
  const supportLabel: Record<string, string> = {
    community: "Community support",
    email: "Email support",
    "priority-email": "Priority email support",
    priority: "Priority support",
    dedicated: "Dedicated account manager",
  };
  items.push(supportLabel[support] ?? "Support");

  return items;
}

export default async function PricingPage() {
  const plans = await apiFetchSafe<SubscriptionPlanDto[]>("/v1/plans", []);
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/pricing", label: "Pricing" }]} />
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Simple pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Plans for every stage of bidding
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-500">
          Start with the free plan. Upgrade when you need more saved tenders, more alert rules or
          document assistance. All prices are in Pakistani Rupees (PKR).
        </p>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-5">
        {sorted.map((plan) => {
          const price = Number(plan.pricePkr);
          const isFree = plan.code === "free";
          const isEnterprise = plan.code === "enterprise";
          const isPopular = plan.isPopular;
          const features = featureList(plan);
          return (
            <div
              key={plan.id}
              className={
                isPopular
                  ? "relative flex flex-col rounded-2xl border-2 border-emerald-600 bg-white p-5 shadow-lifted"
                  : "relative flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card"
              }
            >
              {isPopular ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Most popular
                </span>
              ) : null}
              <h2 className="text-base font-bold text-navy-900">{plan.name}</h2>
              <p className="mt-1 min-h-10 text-xs leading-5 text-ink-500">{plan.description}</p>
              <p className="mt-4 text-2xl font-extrabold tracking-tight text-navy-900">
                {isEnterprise ? "Custom" : isFree ? "Free" : formatPkr(plan.pricePkr)}
                {!isFree && !isEnterprise ? (
                  <span className="text-xs font-medium text-ink-500">/{plan.interval === "YEAR" ? "year" : "month"}</span>
                ) : null}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-xs text-ink-600">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isFree ? (
                  <ButtonLink href="/register" className="w-full">
                    Create free account
                  </ButtonLink>
                ) : (
                  <a
                    href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent(`Activate ${plan.name} plan`)}`}
                    className={isPopular ? "btn-primary w-full" : "btn-secondary w-full"}
                  >
                    Contact to activate
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Plans are not available right now. Please check back shortly.
        </div>
      ) : null}

      <div className="mt-10 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-bold text-navy-900">Payment activation notice</h2>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              Online payment gateways are not configured in this environment yet. Paid plans are
              displayed for transparency but cannot be purchased until JazzCash, Easypaisa or card
              payments are enabled. Contact support to arrange activation. The Free plan works
              immediately.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-16">
        <SectionHeading eyebrow="Questions" title="Pricing FAQ" align="center" />
        <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-white">
          {[
            {
              q: "Is the Free plan really free?",
              a: "Yes. The Free plan requires no payment details and lets you browse published tenders and save a limited number of records. Some limits apply to alert rules and AI assistant messages.",
            },
            {
              q: "How do I upgrade a paid plan?",
              a: "Paid plans require a configured payment gateway. Until then, contact support and the team will confirm availability. No payment is collected on this website today.",
            },
            {
              q: "Can I use one account on web and mobile?",
              a: "Yes. Accounts, saved tenders, saved searches and alert rules are shared across the website and the mobile apps.",
            },
            {
              q: "What happens if I stop paying?",
              a: "Your account returns to the Free plan limits at the end of the billing period. Saved tenders beyond the free limit remain stored but may not all be accessible until you upgrade again.",
            },
            {
              q: "Do you guarantee that a tender is genuine?",
              a: "No. Pak Tenders is an information platform. Verification status is shown on every record, and you must confirm details with the issuing department before bidding. Demo records are explicitly labelled.",
            },
          ].map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-navy-900">
                {item.q}
                <HelpCircle className="h-4 w-4 shrink-0 text-ink-500 group-open:text-emerald-600" />
              </summary>
              <p className="mt-2 text-sm leading-6 text-ink-500">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-500">
          Still have questions?{" "}
          <Link href="/contact" className="font-semibold text-emerald-700 hover:underline">
            Contact support
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
