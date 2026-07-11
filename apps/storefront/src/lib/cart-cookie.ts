const COOKIE_PREFIX = "cart_";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function getCartCookieName(tenantSlug: string): string {
  return `${COOKIE_PREFIX}${tenantSlug}`;
}

export function getCartId(tenantSlug: string): string | null {
  if (typeof document === "undefined") return null;
  const name = getCartCookieName(tenantSlug);
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function setCartId(tenantSlug: string, cartId: string): void {
  if (typeof document === "undefined") return;
  const name = getCartCookieName(tenantSlug);
  document.cookie = `${name}=${encodeURIComponent(cartId)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function removeCartId(tenantSlug: string): void {
  if (typeof document === "undefined") return;
  const name = getCartCookieName(tenantSlug);
  document.cookie = `${name}=; path=/; max-age=0`;
}
