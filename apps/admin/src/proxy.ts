// apps/admin/src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Deny-by-default: only sign-in and webhooks are public. Every other admin
// route (dashboard, orders, settings, products, ...) requires a Clerk session.
const isPublicRoute = createRouteMatcher([
  "/auth/sign-in(.*)",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
