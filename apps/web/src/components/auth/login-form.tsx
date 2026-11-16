"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";
import { safeNextPath } from "./safe-next";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data?.message.join(", ")
          : typeof data?.message === "string"
            ? data.message
            : "Sign in failed. Check your email and password.";
        setError(message);
        return;
      }
      router.replace(safeNextPath(next));
      router.refresh();
    } catch {
      setError("The service is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-bold text-navy-900">Sign in to Pak Tenders</h1>
      <p className="mt-1 text-sm text-ink-500">
        Access your saved tenders, searches and alerts.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.pk"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-emerald-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        New to Pak Tenders?{" "}
        <Link href="/register" className="font-semibold text-emerald-700 hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
