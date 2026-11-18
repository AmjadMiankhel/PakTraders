import type { Metadata } from "next";
import { SignedInRedirect } from "@/components/auth/auth-gate";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSettings } from "@/lib/public-settings";

export const metadata: Metadata = {
  title: "Create your free account",
  description:
    "Create a free Pak Tenders account to save tenders, set up alerts and track procurement opportunities across Pakistan.",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getPublicSettings()]);
  if (user) return <SignedInRedirect to="/dashboard" />;
  const registrationEnabled = settings["features.registration"] !== false;
  return <RegisterForm registrationEnabled={registrationEnabled} />;
}
