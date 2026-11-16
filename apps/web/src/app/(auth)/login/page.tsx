import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";
import { firstValue, type RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Pak Tenders account to manage saved tenders, searches and alerts.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  return <LoginForm next={firstValue(params.next)} />;
}
