import { verifyToken, type VerifyTokenOptions } from "@clerk/backend";
import { headers } from "next/headers";

/**
 * Verify a Clerk JWT token in a Next.js Route Handler or Server Component.
 * Uses @clerk/backend's verifyToken for standalone verification.
 *
 * This is the frontend-facing JWT verification that works alongside
 * the Python backend's independent verification. Both stacks verify
 * the same token using Clerk's public keys.
 *
 * Usage in Route Handler:
 * ```ts
 * import { verifyClerkToken } from "@repo/auth/server";
 * export async function GET(request: NextRequest) {
 *   const result = await verifyClerkToken();
 *   if (!result.valid) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 *   // result.payload has userId, orgId, etc.
 * }
 * ```
 */
export async function verifyClerkToken(options?: Partial<VerifyTokenOptions>): Promise<{ valid: boolean; payload: Record<string, unknown> | null; error?: string }> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");

  if (!authHeader) {
    return { valid: false, payload: null, error: "No authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");

  const result = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY ?? "",
    ...options,
  });

  return { valid: result !== null, payload: result ?? null };
}

/**
 * Get the current user in a Route Handler by verifying the token.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const result = await verifyClerkToken();
  if (!result.valid) return null;
  return result.payload;
}
