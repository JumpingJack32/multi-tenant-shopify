import { ProductGrid } from "@/components/storefront/product-grid";
import { fetchCollections, fetchProducts } from "@/lib/api";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant, slug } = await params;
  const collections = await fetchCollections(tenant);
  const collection = collections.find((c) => c.slug === slug);

  if (!collection) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Collection not found</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="relative aspect-[3/1] rounded-lg overflow-hidden bg-black mb-12">
        {collection.hero_image_url && (
          <img
            src={collection.hero_image_url}
            alt={collection.hero_image_alt || collection.name}
            className="object-cover w-full h-full opacity-60"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-white/80 text-lg">{collection.description}</p>
            )}
          </div>
        </div>
      </div>

      <ProductGrid tenantSlug={tenant} collectionSlug={slug} />
    </div>
  );
}
