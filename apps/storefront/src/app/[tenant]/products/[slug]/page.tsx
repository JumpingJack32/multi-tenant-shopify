import { notFound } from "next/navigation";

import { fetchStorefrontProduct, fetchStorefrontProducts } from "@/lib/storefront-api";

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

  const relatedProducts = product.category_slug
    ? (await fetchStorefrontProducts(tenant, { category: product.category_slug }))
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
    : [];

  return (
    <main className="min-h-screen bg-background">
      <ProductDetail product={product} tenantSlug={tenant} relatedProducts={relatedProducts} />
    </main>
  );
}
