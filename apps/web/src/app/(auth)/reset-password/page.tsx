import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { firstValue, type RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Pak Tenders account.",
  robots: { index: false, follow: true },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm token={firstValue(params.token) ?? ""} />;
}
