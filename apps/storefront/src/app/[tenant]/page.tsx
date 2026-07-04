import Link from "next/link";
import type { Product } from "@repo/tenant-orm/types";

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

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolved = await params;
  let products: Product[] = [];

  try {
    products = await fetchProducts(resolved.tenant);
  } catch {
    products = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to home
        </Link>
      </div>
      <h1 className="mb-8 text-3xl font-bold tracking-tight capitalize">
        {resolved.tenant}
      </h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-lg border border-border p-4 transition-colors hover:border-primary"
          >
            <h2 className="font-semibold">{product.name}</h2>
            {product.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {product.description}
              </p>
            )}
          </div>
        ))}
      </div>
      {products.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          No products available yet.
        </p>
      )}
    </main>
  );
}
