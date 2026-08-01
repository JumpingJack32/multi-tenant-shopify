"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "@repo/ui/icons";

/**
 * Non-blocking offline indicator for the public storefront. Driven by the
 * browser's native `online`/`offline` events. Shows a slim banner so shoppers
 * can keep browsing cached pages, and auto-dismisses on reconnect.
 */
export function ClerkLoadErrorBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

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
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4"
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 shadow-md backdrop-blur-sm">
        <WifiOffIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          You&apos;re offline — viewing saved pages
        </p>
      </div>
    </div>
  );
}
