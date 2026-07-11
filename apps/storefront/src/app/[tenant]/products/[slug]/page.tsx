import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchStorefrontProduct } from "@/lib/storefront-api";

import { ProductDetail } from "./product-detail";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant, slug } = await params;
  const product = await fetchStorefrontProduct(tenant, slug);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link
          href={`/${tenant}/products`}
          className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Products
        </Link>
      </div>
      <ProductDetail product={product} tenantSlug={tenant} />
    </main>
  );
}
