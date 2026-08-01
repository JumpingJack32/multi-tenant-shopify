"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { WifiOffIcon } from "@repo/ui/icons";

const LOAD_TIMEOUT_MS = 15_000;

/**
 * Detects when Clerk's JS bundle fails to load (e.g. network disconnected)
 * and surfaces a friendly reconnection message with retry/dismiss actions.
 *
 * ClerkProvider swallows the load error internally (emits an internal status
 * event and console.errors) — it is not exposed via React state or props.
 * We detect the failure by observing that `useAuth` never becomes loaded
 * within the load timeout window.
 */
export function ClerkLoadErrorBanner() {
  const { isLoaded } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setFailed(false);
      return;
    }
    const timer = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  if (!failed || isLoaded) return null;

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <WifiOffIcon className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          You appear to be offline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check your network connection and try again.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Retry
          </button>
          <button
            onClick={() => setFailed(false)}
            className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
