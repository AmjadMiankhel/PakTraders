import { apiFetchSafe } from "./server-api";
import { siteConfig } from "./site";

export type PublicSettings = Record<string, unknown>;

/** Reads admin-editable public settings; falls back to safe defaults offline. */
export async function getPublicSettings(): Promise<PublicSettings> {
  return apiFetchSafe<PublicSettings>("/v1/settings/public", {});
}

export function settingString(
  settings: PublicSettings,
  key: string,
  fallback: string,
): string {
  const value = settings[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function settingBoolean(
  settings: PublicSettings,
  key: string,
  fallback: boolean,
): boolean {
  const value = settings[key];
  return typeof value === "boolean" ? value : fallback;
}

export function siteIdentity(settings: PublicSettings) {
  return {
    name: settingString(settings, "site.name", siteConfig.name),
    tagline: settingString(settings, "site.tagline", siteConfig.tagline),
    supportEmail: settingString(settings, "site.supportEmail", siteConfig.supportEmail),
    supportPhone: settingString(settings, "site.supportPhone", siteConfig.supportPhone),
    announcement:
      typeof settings["site.announcement"] === "string" && settings["site.announcement"].length > 0
        ? (settings["site.announcement"] as string)
        : null,
  };
}
