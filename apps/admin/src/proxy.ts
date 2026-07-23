// apps/admin/src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/sign-in(.*)",
  "/api/webhooks/(.*)",
  "/api/v1/(.*)",
  "/dashboard(.*)",
  "/analytics(.*)",
  "/products(.*)",
  "/customers(.*)",
  "/marketing(.*)",
  "/inventory(.*)",
  "/orders(.*)",
  "/settings(.*)",
  "/sales-channel(.*)",
  "/finances(.*)",
  "/discounts(.*)",
  "/suppliers(.*)",
  "/transfers(.*)",
  "/content(.*)",
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
