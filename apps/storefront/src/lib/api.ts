import type { Product } from "@repo/tenant-orm/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchProducts(
  tenantSlug: string,
  signal?: AbortSignal,
): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/products/${tenantSlug}`, {
      signal,
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}
