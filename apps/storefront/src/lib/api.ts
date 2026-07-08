import type { Category, Collection, Product } from "@repo/tenant-orm/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchProducts(
  tenantSlug: string,
  categorySlug?: string,
  signal?: AbortSignal,
  options?: { collection?: string },
): Promise<Product[]> {
  try {
    const url = new URL(`${API_URL}/api/v1/public/products/${tenantSlug}`);
    if (categorySlug) {
      url.searchParams.set("category", categorySlug);
    }
    if (options?.collection) {
      url.searchParams.set("collection", options.collection);
    }
    const res = await fetch(url.toString(), {
      signal,
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

export async function fetchCollections(
  tenantSlug: string,
): Promise<Collection[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/public/collections/${tenantSlug}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return [];
    return res.json() as Promise<Collection[]>;
  } catch {
    return [];
  }
}

export async function fetchCategories(tenantSlug: string): Promise<Category[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/public/categories/${tenantSlug}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return [];
    return res.json() as Promise<Category[]>;
  } catch {
    return [];
  }
}
