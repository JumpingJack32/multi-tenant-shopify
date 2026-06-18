import { createTenantClient } from "@repo/tenant-orm/client";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolved = await params;
  const client = createTenantClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: products } = await client.db
    .from("products")
    .select("*")
    .eq("tenant_id", resolved.tenant)
    .eq("status", "active");

  return (
    <main>
      <h1>Products for {resolved.tenant}</h1>
      <div>
        {products?.map((product) => (
          <div key={product.id}>
            <h2>{product.name}</h2>
            <p>${(product.price / 100).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
