import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchStorefrontProduct, fetchStorefrontProducts } from "@/lib/storefront-api";

import { ProductDetail } from "./product-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}): Promise<Metadata> {
  const { tenant, slug } = await params;
  const product = await fetchStorefrontProduct(tenant, slug);

  if (!product) {
    return { title: "Product Not Found" };
  }

  const primaryImage = product.images?.[0]?.url;
  const description =
    product.description ?? `${product.name} — available now.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: primaryImage ? [{ url: primaryImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: primaryImage ? [primaryImage] : undefined,
    },
  };
}

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

  const firstVariant = product.variants?.[0];
  const priceCents = firstVariant?.price ?? product.min_price;
  const inStock = product.variants?.some((v) => v.in_stock) ?? false;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.images?.map((img) => img.url) ?? [],
    description: product.description ?? "",
    sku: firstVariant?.sku ?? "",
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: (priceCents / 100).toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-background">
        <ProductDetail product={product} tenantSlug={tenant} relatedProducts={relatedProducts} />
      </main>
    </>
  );
}
