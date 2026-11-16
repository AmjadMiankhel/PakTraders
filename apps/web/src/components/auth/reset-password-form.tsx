"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
      if (!response.ok) {
        const text = Array.isArray(data?.message)
          ? data?.message.join(", ")
          : typeof data?.message === "string"
            ? data.message
            : "The reset link may be invalid or expired.";
        setError(text);
        return;
      }
      setMessage("Your password has been updated. You can now sign in with the new password.");
    } catch {
      setError("The service is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-bold text-navy-900">Reset link missing</h1>
        <Alert tone="warning" className="mt-4">
          This page needs a valid reset token. Request a new reset link to continue.
        </Alert>
        <Link href="/forgot-password" className="btn-primary mt-6 w-full">
          Request a reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-bold text-navy-900">Choose a new password</h1>
      <p className="mt-1 text-sm text-ink-500">Set a new password for your Pak Tenders account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            placeholder="At least 10 characters"
          />
          <p className="mt-1 text-xs text-ink-500">
            Use at least 10 characters with an uppercase letter, a lowercase letter and a number.
          </p>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            placeholder="Repeat your password"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
