import type {
  CartResponse,
  CartAddItemRequest,
  CartUpdateItemRequest,
  CheckoutRequest,
  StorefrontProductResponse,
  TenantSettingsResponse,
  PaginatedResponseStorefrontProductResponse as PaginatedProducts,
} from "@repo/codegen/client/types.gen";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Settings ──

export async function fetchSettings(
  tenantSlug: string,
  signal?: AbortSignal,
): Promise<TenantSettingsResponse | null> {
  try {
    return await fetchJson<TenantSettingsResponse>(
      `${API_URL}/api/v1/storefront/${tenantSlug}/settings`,
      { signal, next: { revalidate: 300 } },
    );
  } catch {
    return null;
  }
}

// ── Products ──

export async function fetchStorefrontProducts(
  tenantSlug: string,
  options?: { category?: string; collection?: string; signal?: AbortSignal },
): Promise<StorefrontProductResponse[]> {
  try {
    const url = new URL(`${API_URL}/api/v1/storefront/${tenantSlug}/products`);
    if (options?.category) url.searchParams.set("category", options.category);
    if (options?.collection)
      url.searchParams.set("collection", options.collection);
    const res = await fetchJson<PaginatedProducts>(url.toString(), {
      signal: options?.signal,
      next: { revalidate: 0 },
    });
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchStorefrontProduct(
  tenantSlug: string,
  productSlug: string,
): Promise<StorefrontProductResponse | null> {
  try {
    return await fetchJson<StorefrontProductResponse>(
      `${API_URL}/api/v1/storefront/${tenantSlug}/products/${productSlug}`,
      { next: { revalidate: 0 } },
    );
  } catch {
    return null;
  }
}

// ── Cart ──

export async function createCart(
  tenantSlug: string,
  variantId: string,
  quantity: number = 1,
): Promise<CartResponse> {
  return fetchJson<CartResponse>(
    `${API_URL}/api/v1/storefront/${tenantSlug}/carts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant_id: variantId,
        quantity,
      } satisfies CartAddItemRequest),
    },
  );
}

export async function getCart(
  tenantSlug: string,
  cartId: string,
): Promise<CartResponse | null> {
  try {
    return await fetchJson<CartResponse>(
      `${API_URL}/api/v1/storefront/${tenantSlug}/carts/${cartId}`,
    );
  } catch {
    return null;
  }
}

export async function addCartItem(
  tenantSlug: string,
  cartId: string,
  variantId: string,
  quantity: number = 1,
): Promise<CartResponse> {
  return fetchJson<CartResponse>(
    `${API_URL}/api/v1/storefront/${tenantSlug}/carts/${cartId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant_id: variantId,
        quantity,
      } satisfies CartAddItemRequest),
    },
  );
}

export async function updateCartItem(
  tenantSlug: string,
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<CartResponse> {
  return fetchJson<CartResponse>(
    `${API_URL}/api/v1/storefront/${tenantSlug}/carts/${cartId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity } satisfies CartUpdateItemRequest),
    },
  );
}

export async function removeCartItem(
  tenantSlug: string,
  cartId: string,
  itemId: string,
): Promise<CartResponse> {
  return fetchJson<CartResponse>(
    `${API_URL}/api/v1/storefront/${tenantSlug}/carts/${cartId}/items/${itemId}`,
    { method: "DELETE" },
  );
}

export async function clearCart(
  tenantSlug: string,
  cartId: string,
): Promise<void> {
  await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/carts/${cartId}`, {
    method: "DELETE",
  });
}

export async function checkoutCart(
  tenantSlug: string,
  cartId: string,
  data: CheckoutRequest = {
    currency: "USD",
    shipping_address: {},
    billing_address: {},
  },
): Promise<{ order_id: string }> {
  return fetchJson<{ order_id: string }>(
    `${API_URL}/api/v1/storefront/${tenantSlug}/carts/${cartId}/checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
