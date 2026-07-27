import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { ProductListing } from "@/components/storefront/product-listing";
import { fetchStorefrontProducts } from "@/lib/storefront-api";

const KNOWN_TOP_LEVEL = new Set([
  "women", "men", "children", "gifts", "trench", "scarves", "bags", "beauty",
]);

export default async function TaxonomyCategoryPage({
  params,
}: {
  params: Promise<{ tenant: string; path: string[] }>;
}) {
  const { tenant, path } = await params;
  if (!path || path.length === 0) notFound();

  const leafSlug = path[path.length - 1]!;

  if (!KNOWN_TOP_LEVEL.has(path[0]!)) {
    notFound();
  }

  const products = await fetchStorefrontProducts(tenant, { category: leafSlug });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className="text-sm text-muted-foreground mb-6">
          <Link href={`/${tenant}`} className="hover:text-foreground">Home</Link>
          {path.map((segment, i) => (
            <span key={segment}>
              {" "}&gt;{" "}
              <span className={i === path.length - 1 ? "text-foreground font-medium" : ""}>
                {segment.replace(/-/g, " ")}
              </span>
            </span>
          ))}
        </nav>

        <h1 className="text-2xl font-bold mb-2 capitalize">
          {leafSlug.replace(/-/g, " ")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Showing {products.length} product{products.length !== 1 ? "s" : ""}
        </p>

        <Suspense fallback={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        }>
          <ProductListing
            initialProducts={products}
            tenant={tenant}
            categorySlug={leafSlug}
          />
        </Suspense>
      </div>
    </div>
  );
}
