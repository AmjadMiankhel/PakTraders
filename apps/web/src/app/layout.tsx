import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSettings, siteIdentity } from "@/lib/public-settings";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Pak Tenders – Latest Government & Private Tenders in Pakistan",
    template: "%s | Pak Tenders",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "Pakistan tenders",
    "government tenders Pakistan",
    "PPRA tenders",
    "private tenders",
    "procurement opportunities",
    "tender alerts",
    "Pak Tenders",
  ],
  authors: [{ name: "Pak Tenders" }],
  creator: "Pak Tenders",
  publisher: "Pak Tenders",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_PK",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "Pak Tenders – Latest Government & Private Tenders in Pakistan",
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pak Tenders – Tender intelligence for Pakistan",
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  category: "business",
};

export const viewport: Viewport = {
  themeColor: "#0A1B36",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getPublicSettings()]);
  const identity = siteIdentity(settings);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: identity.name,
    url: siteConfig.url,
    description: siteConfig.description,
    areaServed: "PK",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: identity.supportEmail,
      availableLanguage: ["en", "ur"],
    },
  };

  return (
    <html lang="en-PK">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader
          user={user}
          supportEmail={identity.supportEmail}
          supportPhone={identity.supportPhone}
          announcement={identity.announcement}
        />
        <main id="main-content">{children}</main>
        <SiteFooter supportEmail={identity.supportEmail} supportPhone={identity.supportPhone} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
