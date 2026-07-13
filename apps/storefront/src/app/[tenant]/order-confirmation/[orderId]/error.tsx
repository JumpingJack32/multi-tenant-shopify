"use client";

import { useEffect } from "react";

import { trackError } from "@/lib/error-tracking";

export default function OrderConfirmationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    trackError(error, { page: "order-confirmation" });
  }, [error]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <h1 className="font-heading text-2xl font-light tracking-wide mb-3">
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          We couldn&apos;t load your order confirmation. Please try again.
        </p>
        <button
          onClick={reset}
          className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
