"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps, ReactNode } from "react";

import { CLERK_JS_URL } from "@/lib/clerk-config";

type ClerkProviderProps = ComponentProps<typeof ClerkProvider>;

/**
 * Typed wrapper around `ClerkProvider` that pins the Clerk JS bundle to a
 * concrete version via `__internal_clerkJSUrl`. The prop is honored at
 * runtime but omitted from the public prop types, so it is cast here.
 */
export function ClerkProviderPinned({ children }: { children: ReactNode }) {
  const props = {
    __internal_clerkJSUrl: CLERK_JS_URL,
  } as unknown as ClerkProviderProps;

  return <ClerkProvider {...props}>{children}</ClerkProvider>;
}
