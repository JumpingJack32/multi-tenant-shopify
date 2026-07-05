import Link from "next/link";
import { notFound } from "next/navigation";
import type { Product } from "@repo/tenant-orm/types";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductInfo } from "@/components/storefront/product-info";

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

export default async function ProductPage({
  params,
}: {
  params: Promise<{ tenant: string; category: string; slug: string }>;
}) {
  const { tenant, category, slug } = await params;
  let products: Product[] = [];

  try {
    products = await fetchProducts(tenant);
  } catch {
    products = [];
  }

  const product = products.find((p) => p.slug === slug);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link
          href={`/${tenant}/shop/${category}`}
          className="inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to {category}
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4 pb-8">
        <div>
          <ProductGallery images={product.images ?? []} name={product.name} />
        </div>
        <div>
          <ProductInfo product={product} />
        </div>
      </div>
    </main>
  );
}
