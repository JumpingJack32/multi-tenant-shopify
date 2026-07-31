import Link from "next/link";

import { fetchStorefrontProducts } from "@/lib/storefront-api";

import { ProductCard } from "./product-card";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const products = await fetchStorefrontProducts(tenant);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">All Products</h1>
        {products.length === 0 ? (
          <p className="text-muted-foreground">No products available yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                tenantSlug={tenant}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
