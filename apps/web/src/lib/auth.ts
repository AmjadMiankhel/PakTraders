import type { AuthUser } from "@paktenders/shared-types";
import { apiFetch } from "./server-api";

/** Returns the signed-in user or null. Safe to call from layouts and pages. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/v1/auth/me");
  } catch {
    return null;
  }
}

export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.some((role) =>
    [
      "SUPER_ADMIN",
      "ADMIN",
      "TENDER_MANAGER",
      "FINANCE_MANAGER",
      "TECHNICAL_ADMIN",
      "CONTENT_MANAGER",
      "SEO_MANAGER",
      "CUSTOMER_SUPPORT",
      "VERIFICATION_OFFICER",
      "AI_MANAGER",
      "NOTIFICATION_MANAGER",
      "RESEARCHER",
    ].includes(role),
  );
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}
