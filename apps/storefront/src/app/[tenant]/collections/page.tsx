import { fetchCollections } from "@/lib/api";
import Link from "next/link";

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const collections = await fetchCollections(tenant);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Collections</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((col) => (
          <Link
            key={col.id}
            href={`/${tenant}/collections/${col.slug}`}
            className="relative aspect-[3/2] rounded-lg overflow-hidden bg-black group"
          >
            {col.hero_image_url && (
              <img
                src={col.hero_image_url}
                alt={col.hero_image_alt || col.name}
                className="object-cover w-full h-full opacity-60 group-hover:opacity-80 transition-opacity"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <h2 className="text-white text-2xl font-bold tracking-wide">
                {col.name}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
