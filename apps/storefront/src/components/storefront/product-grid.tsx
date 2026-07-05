import Link from "next/link";
import type { Product } from "@repo/tenant-orm/types";
import { ProductCard } from "./product-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchProducts(tenantSlug: string): Promise<Product[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_URL}/api/v1/public/products/${tenantSlug}`, {
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return [];
    }

    return res.json() as Promise<Product[]>;
  } finally {
    clearTimeout(timeout);
  }
}

interface ProductGridProps {
  tenantSlug: string;
  categorySlug?: string;
}

export async function ProductGrid({
  tenantSlug,
  categorySlug = "",
}: ProductGridProps) {
  let products: Product[] = [];

  try {
    products = await fetchProducts(tenantSlug);
  } catch {
    products = [];
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 bg-black min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">No products available yet.</p>
          <Link
            href="/"
            className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 bg-black">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          categorySlug={categorySlug}
        />
      ))}
    </div>
  );
}
