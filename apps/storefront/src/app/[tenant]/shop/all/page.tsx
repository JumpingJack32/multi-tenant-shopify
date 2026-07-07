import { ProductGrid } from "@/components/storefront/product-grid";

export default async function ShopAllPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <main className="min-h-screen bg-black">
      <ProductGrid tenantSlug={tenant} />
    </main>
  );
}
