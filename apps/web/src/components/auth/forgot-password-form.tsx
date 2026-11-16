"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? "").trim() }),
      });
      const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
      if (!response.ok) {
        const text = Array.isArray(data?.message)
          ? data?.message.join(", ")
          : typeof data?.message === "string"
            ? data.message
            : "Could not process the request.";
        setError(text);
        return;
      }
      setMessage(
        typeof data?.message === "string"
          ? data.message
          : "If an account exists for that email, a reset link has been prepared.",
      );
    } catch {
      setError("The service is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-bold text-navy-900">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-500">
        Enter the email address linked to your account and we will prepare reset instructions.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="info">{message}</Alert> : null}

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

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Submitting…" : "Send reset instructions"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
