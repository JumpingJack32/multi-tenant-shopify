// apps/storefront/src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/stores',
  '/api/stores/(.*)',
])


export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth() // Invoking auth as a function requires an await in v7

  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn() // Manually push them to sign-in
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
