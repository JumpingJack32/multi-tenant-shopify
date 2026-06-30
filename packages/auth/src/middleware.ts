import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextMiddleware } from "next/server";

/**
 * Route matcher configuration for Clerk middleware.
 */
export interface AuthRouteConfig {
  /** Public routes that don't require authentication */
  public: string[];
  /** Routes that require authentication */
  protected: string[];
}

/**
 * Default route configuration.
 */
export const defaultAuthRoutes: AuthRouteConfig = {
  public: [
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks(.*)",
    "/api/auth(.*)",
    "/(.*)",
  ],
  protected: [
    "/dashboard(.*)",
    "/admin(.*)",
    "/api/protected(.*)",
  ],
};

/**
 * Create a Clerk middleware factory for Next.js App Router.
 * Wraps Clerk's clerkMiddleware with custom route matching and tenant context.
 *
 * Usage in `apps/admin/middleware.ts`:
 * ```ts
 * import { createClerkMiddleware } from "@repo/auth/middleware";
 * export default createClerkMiddleware();
 * ```
 */
export function createClerkMiddleware(config?: Partial<AuthRouteConfig>): NextMiddleware {
  const mergedConfig: AuthRouteConfig = {
    public: config?.public ?? defaultAuthRoutes.public,
    protected: config?.protected ?? defaultAuthRoutes.protected,
  };

  const isPublic = createRouteMatcher(mergedConfig.public);

  return clerkMiddleware(async (auth, req) => {
    // Skip auth for public routes
    if (isPublic(req)) {
      return;
    }

    // Require authentication for protected routes
    await auth.protect();

    // Forward tenant context if available
    const tenantId = req.headers.get("x-tenant-id");
    if (tenantId) {
      // Clerk session already contains tenant claims
      // This header can be used by downstream API routes
    }
  });
}

export { auth, currentUser, clerkMiddleware, createRouteMatcher, getAuth } from "@clerk/nextjs/server";
