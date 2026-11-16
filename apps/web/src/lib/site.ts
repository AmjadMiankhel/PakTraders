/**
 * Static site configuration and navigation. Values that administrators can edit
 * at runtime (support email, announcement) come from the public settings API;
 * these are the safe defaults used when that endpoint is unavailable.
 */
export const siteConfig = {
  name: "Pak Tenders",
  shortName: "Pak Tenders",
  domain: "paktenders.pk",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  tagline: "Discover. Analyze. Track. Win.",
  description:
    "Find the latest government and private tenders in Pakistan. Explore PPRA, construction, IT, medical, solar, NGO, consultancy and business procurement opportunities with tender updates and personalized alerts.",
  supportEmail: "support@paktenders.pk",
  supportPhone: "+92 300 0000000",
  timezone: "Asia/Karachi",
  currency: "PKR",
  locale: "en-PK",
} as const;

export const mainNav = [
  { href: "/tenders", label: "Browse Tenders" },
  { href: "/categories", label: "Categories" },
  { href: "/locations", label: "Locations" },
  { href: "/departments", label: "Departments" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export const footerNav = {
  platform: [
    { href: "/tenders", label: "All tenders" },
    { href: "/categories", label: "Browse by category" },
    { href: "/locations", label: "Browse by location" },
    { href: "/departments", label: "Government departments" },
    { href: "/pricing", label: "Plans & pricing" },
  ],
  company: [
    { href: "/about", label: "About Pak Tenders" },
    { href: "/contact", label: "Contact & support" },
    { href: "/pricing", label: "Plans & pricing" },
  ],
  legal: [
    { href: "/terms", label: "Terms of service" },
    { href: "/privacy", label: "Privacy policy" },
    { href: "/disclaimer", label: "Disclaimer" },
  ],
} as const;
