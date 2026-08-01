/**
 * Clerk JS frontend API script URL, pinned to a concrete version.
 *
 * Clerk's default loader requests `clerk-js@6/dist/clerk.browser.js` which
 * issues a 307 redirect to the resolved version (e.g. `@6.25.13`). Some
 * browsers/proxies intermittently fail on that redirect, surfacing as
 * `failed_to_load_clerk_js` / "network unavailable". Pinning the resolved URL
 * skips the redirect entirely.
 *
 * `__internal_clerkJSUrl` is honored at runtime (see `@clerk/shared`
 * `clerkJSScriptUrl`) but absent from the public `ClerkProvider` prop types,
 * hence the typed wrapper.
 */
export const CLERK_JS_URL =
  "https://adapted-lionfish-93.clerk.accounts.dev/npm/@clerk/clerk-js@6.25.13/dist/clerk.browser.js";
