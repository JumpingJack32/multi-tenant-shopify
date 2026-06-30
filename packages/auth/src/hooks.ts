import { useAuth as useClerkAuth, useUser } from "@clerk/nextjs";
import { useTenantId } from "./tenant";

/**
 * Re-export Clerk's useAuth with proper typing.
 * Clerk v7: useAuth() returns { userId, sessionId, getToken, ... }
 */
export { useAuth } from "@clerk/nextjs";

/**
 * Wrapper around Clerk's useUser that returns normalized user data.
 */
export function useAppUser() {
  const { user } = useUser();
  return {
    id: user?.id ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    imageUrl: user?.imageUrl ?? null,
    externalId: user?.externalId ?? null,
  };
}

/**
 * Get the current tenant ID from context.
 * Throws if no tenant is active (e.g., admin routes).
 */
export { useTenantId };

/**
 * Check if current user is authenticated.
 */
export function useIsAuthenticated() {
  const { isSignedIn } = useClerkAuth();
  return isSignedIn ?? false;
}

/**
 * Get the current Clerk session token.
 * Safe to call outside of request context (returns null if not available).
 */
export async function useSessionToken() {
  const { getToken } = useClerkAuth();
  if (!getToken) return null;
  return getToken({ template: "tenant" });
}
