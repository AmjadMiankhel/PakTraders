"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";
import { deleteAccount } from "@/lib/actions";

export function DeleteAccountForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (form.get("confirmation") !== "DELETE") {
      setError('Type DELETE exactly to confirm.');
      return;
    }
    if (!window.confirm("This permanently deletes your account and signs you out. Continue?")) {
      return;
    }
    setPending(true);
    try {
      const result = await deleteAccount(form);
      if (!result.ok) {
        setError(result.message ?? "Could not delete the account.");
        return;
      }
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div>
        <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
        <Input id="delete-confirmation" name="confirmation" autoComplete="off" placeholder="DELETE" />
      </div>
      <button type="submit" disabled={pending} className="btn-danger">
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
