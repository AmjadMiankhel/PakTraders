/**
 * Pak Tenders design tokens — single source of truth for web and mobile.
 *
 * The web app mirrors these values as CSS custom properties in
 * apps/web/src/app/globals.css (@theme block). The mobile app consumes the
 * JS object directly. Keep both in sync when changing brand colours.
 */

export const colors = {
  navy: {
    50: "#F0F4FA",
    100: "#DCE6F5",
    200: "#B9CCE8",
    300: "#8FACD6",
    400: "#5C82BC",
    500: "#365E9B",
    600: "#24477C",
    700: "#173462",
    800: "#10264A",
    900: "#0A1B36",
    950: "#061224",
  },
  emerald: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    300: "#6EE7B7",
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
    700: "#047857",
    800: "#065F46",
    900: "#064E3B",
  },
  charcoal: {
    500: "#52606D",
    600: "#3E4C59",
    700: "#323F4B",
    800: "#1F2933",
    900: "#111827",
  },
  surface: {
    white: "#FFFFFF",
    muted: "#F7F9FC",
    border: "#E4E9F2",
  },
  semantic: {
    success: "#059669",
    warning: "#B45309",
    danger: "#B91C1C",
    info: "#1D4ED8",
  },
} as const;

export const gradients = {
  brand: "linear-gradient(135deg, #0A1B36 0%, #173462 55%, #065F46 100%)",
  heroOverlay:
    "linear-gradient(180deg, rgba(6,18,36,0.92) 0%, rgba(10,27,54,0.78) 55%, rgba(6,95,70,0.65) 100%)",
  accent: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
} as const;

export const typography = {
  fontSans:
    "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  fontUrdu:
    "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Noto Naskh Arabic', serif",
  scale: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  },
} as const;

export const radii = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(10, 27, 54, 0.06), 0 8px 24px rgba(10, 27, 54, 0.06)",
  lifted: "0 12px 40px rgba(10, 27, 54, 0.14)",
} as const;

export const brand = {
  name: "Pak Tenders",
  domain: "paktenders.pk",
  url: "https://paktenders.pk",
  tagline: "Discover. Analyze. Track. Win.",
  positioning:
    "Pakistan's Procurement Opportunities & Tender Intelligence Platform",
  timezone: "Asia/Karachi",
  currency: "PKR",
} as const;

export type BrandColors = typeof colors;
export type DesignTokens = {
  colors: BrandColors;
  typography: typeof typography;
  radii: typeof radii;
  spacing: typeof spacing;
};
