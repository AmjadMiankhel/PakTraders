import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { footerNav, siteConfig } from "@/lib/site";

export function SiteFooter({
  supportEmail = siteConfig.supportEmail,
  supportPhone = siteConfig.supportPhone,
}: {
  supportEmail?: string;
  supportPhone?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-navy-800 bg-navy-950 text-white/70">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo variant="light" showTagline />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
            Pakistan&apos;s procurement opportunities and tender intelligence platform. Search
            public notices, follow departments, and never miss a closing date.
          </p>
          <div className="mt-5 space-y-2 text-sm">
            <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 hover:text-white">
              <Mail className="h-4 w-4 text-emerald-400" /> {supportEmail}
            </a>
            <a href={`tel:${supportPhone.replace(/\s+/g, "")}`} className="flex items-center gap-2 hover:text-white">
              <Phone className="h-4 w-4 text-emerald-400" /> {supportPhone}
            </a>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" /> Pakistan · PKT (UTC+5)
            </p>
          </div>
        </div>

        <FooterColumn title="Platform" links={footerNav.platform} />
        <FooterColumn title="Company" links={footerNav.company} />
        <FooterColumn title="Legal" links={footerNav.legal} />
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Pak Tenders. All rights reserved.</p>
          <p className="max-w-xl leading-5">
            Pak Tenders is an independent information platform. Always verify tender details with the
            issuing department before bidding. Records labelled &ldquo;Demo&rdquo; are sample data and are
            not real procurement notices.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
