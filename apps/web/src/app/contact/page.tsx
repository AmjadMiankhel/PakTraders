import type { Metadata } from "next";
import { Mail, MessageSquare, Phone, ShieldAlert } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { siteConfig } from "@/lib/site";
import { getPublicSettings, siteIdentity } from "@/lib/public-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact & support",
  description:
    "Contact Pak Tenders for account help, tender corrections, plan activation and partnership enquiries.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getPublicSettings();
  const identity = siteIdentity(settings);

  const channels = [
    {
      icon: <Mail className="h-5 w-5" />,
      title: "General support",
      body: "Account access, saved tenders, alerts and how the platform works.",
      action: `mailto:${identity.supportEmail}?subject=Support%20request`,
      label: identity.supportEmail,
    },
    {
      icon: <ShieldAlert className="h-5 w-5" />,
      title: "Report a tender",
      body: "Incorrect deadline, wrong department, broken source link or a record that should be removed.",
      action: `mailto:${identity.supportEmail}?subject=Tender%20correction`,
      label: "Report incorrect information",
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: "Plans & partnerships",
      body: "Paid plan activation, team accounts, data partnerships and bulk access.",
      action: `mailto:${identity.supportEmail}?subject=Plans%20and%20partnerships`,
      label: "Contact the team",
    },
  ];

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/contact", label: "Contact" }]} />
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Contact &amp; support</h1>
        <p className="mt-3 text-sm leading-6 text-ink-500">
          We handle support by email so every request has a written record. Include your account
          email and the tender reference number where relevant.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {channels.map((channel) => (
          <div key={channel.title} className="card flex flex-col p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              {channel.icon}
            </span>
            <h2 className="mt-4 text-sm font-bold text-navy-900">{channel.title}</h2>
            <p className="mt-1 flex-1 text-sm leading-6 text-ink-500">{channel.body}</p>
            <a href={channel.action} className="mt-4 text-sm font-semibold text-emerald-700 hover:underline">
              {channel.label}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-base font-bold text-navy-900">Direct contact</h2>
          <div className="mt-4 space-y-3 text-sm">
            <a href={`mailto:${identity.supportEmail}`} className="flex items-center gap-3 text-ink-700 hover:text-emerald-700">
              <Mail className="h-4 w-4 text-emerald-600" /> {identity.supportEmail}
            </a>
            <a href={`tel:${identity.supportPhone.replace(/\s+/g, "")}`} className="flex items-center gap-3 text-ink-700 hover:text-emerald-700">
              <Phone className="h-4 w-4 text-emerald-600" /> {identity.supportPhone}
            </a>
            <p className="flex items-center gap-3 text-ink-500">
              <span className="text-emerald-600">PK</span> Pakistan · Asia/Karachi (UTC+5)
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-500">
            Response times vary. For urgent tender corrections, use the report link and include the
            original source URL.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-bold text-navy-900">Before you write</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-600">
            <li>Check the tender&apos;s source attribution and original notice first.</li>
            <li>Include the tender reference number or page URL for corrections.</li>
            <li>Never send passwords, card details or other secrets by email.</li>
            <li>
              Account deletion and data requests are handled from{" "}
              <span className="font-medium text-navy-900">Dashboard → Profile</span> or by email.
            </li>
          </ul>
          <p className="mt-4 text-xs leading-5 text-ink-500">
            Pak Tenders does not charge for support and will never ask for your password.
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-surface p-6 text-sm leading-6 text-ink-500">
        <p className="font-semibold text-navy-900">Postal address</p>
        <p className="mt-1">
          Pak Tenders operates online from Pakistan. A physical correspondence address will be
          published here once confirmed. For official notices, use the support email above.
        </p>
      </div>
    </div>
  );
}
