"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary px-3 py-2 text-xs no-print"
    >
      <Printer className="h-4 w-4" /> Print
    </button>
  );
}
