import type { Product } from "@repo/tenant-orm/types";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MobileStickyCta } from "@/components/storefront/mobile-sticky-cta";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductInfo } from "@/components/storefront/product-info";
import { fetchProducts } from "@/lib/api";

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
          ← Back to{" "}
          {category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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
      <MobileStickyCta product={product} />
    </main>
  );
}
