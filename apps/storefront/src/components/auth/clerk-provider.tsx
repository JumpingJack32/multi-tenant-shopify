"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps, ReactNode } from "react";

import { CLERK_JS_URL, CLERK_UI_URL } from "@/lib/clerk-config";

type ClerkProviderProps = ComponentProps<typeof ClerkProvider>;

/**
 * Typed wrapper around `ClerkProvider` that pins the Clerk JS + UI bundles to
 * concrete versions via `__internal_clerkJSUrl` / `__internal_clerkUIUrl`.
 * Both props are honored at runtime but omitted from the public prop types,
 * so they are cast here.
 */
export function ClerkProviderPinned({ children }: { children: ReactNode }) {
  const props = {
    __internal_clerkJSUrl: CLERK_JS_URL,
    __internal_clerkUIUrl: CLERK_UI_URL,
  } as unknown as ClerkProviderProps;

  return <ClerkProvider {...props}>{children}</ClerkProvider>;
}
