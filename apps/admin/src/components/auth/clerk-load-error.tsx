"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "@repo/ui/icons";

/**
 * Offline indicator driven by the browser's native `online`/`offline` events.
 * Shows immediately when the network drops — no reliance on Clerk's load
 * lifecycle. Auto-dismisses when connectivity returns.
 */
export function ClerkLoadErrorBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    // Initial state
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

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
          Check your network connection. This page will refresh automatically
          when you reconnect.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Retry Now
          </button>
        </div>
      </div>
    </div>
  );
}
