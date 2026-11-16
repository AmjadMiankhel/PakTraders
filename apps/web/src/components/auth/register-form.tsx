"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";

export function RegisterForm({ registrationEnabled }: { registrationEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim(),
          password,
          acceptTerms: form.get("acceptTerms") === "on",
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data?.message.join(", ")
          : typeof data?.message === "string"
            ? data.message
            : "Registration failed. Please check your details.";
        setError(message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("The service is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!registrationEnabled) {
    return (
      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-bold text-navy-900">Registration is paused</h1>
        <Alert tone="warning" className="mt-4">
          New account registration is currently disabled by the administrator. Please check back
          later or contact support.
        </Alert>
        <Link href="/login" className="btn-secondary mt-6 w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-bold text-navy-900">Create your free account</h1>
      <p className="mt-1 text-sm text-ink-500">
        Browse tenders, save opportunities and set up alerts.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Your full name"
          />
        </div>

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
          <Label htmlFor="phone">Mobile number (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="03xx xxxxxxx"
          />
          <p className="mt-1 text-xs text-ink-500">Pakistani mobile number, e.g. 03001234567.</p>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
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

        <label className="flex items-start gap-2 text-xs leading-5 text-ink-600">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 rounded border-line" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-emerald-700 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-emerald-700 hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
