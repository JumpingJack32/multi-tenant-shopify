"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { WifiOffIcon } from "@repo/ui/icons";

const LOAD_TIMEOUT_MS = 15_000;

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
      className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-background p-4 shadow-lg">
        <WifiOffIcon className="h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            You appear to be offline.
          </p>
          <p className="text-xs text-muted-foreground">
            Check your network connection and try again.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
