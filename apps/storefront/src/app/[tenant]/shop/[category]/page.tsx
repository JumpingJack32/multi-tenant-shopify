import { ProductGrid } from "@/components/storefront/product-grid";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ tenant: string; category: string }>;
}) {
  const { tenant, category } = await params;
  return (
    <main className="min-h-screen bg-black">
      <ProductGrid tenantSlug={tenant} categorySlug={category} />
    </main>
  );
}
