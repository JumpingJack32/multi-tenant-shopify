import type { Product } from "@repo/tenant-orm/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchProducts(tenantSlug: string): Promise<Product[]> {
  const res = await fetch(
    `${API_URL}/api/v1/public/products/${tenantSlug}`,
    { next: { revalidate: 0 } },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.statusText}`);
  }

  return res.json() as Promise<Product[]>;
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolved = await params;
  let products: Product[] = [];
  let error: string | null = null;

  try {
    products = await fetchProducts(resolved.tenant);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load products";
  }

  return (
    <main>
      <h1>Products for {resolved.tenant}</h1>
      {error && <p className="text-red-500">{error}</p>}
      <div>
        {products.map((product) => (
          <div key={product.id}>
            <h2>{product.name}</h2>
          </div>
        ))}
        {!error && products.length === 0 && <p>No products available.</p>}
      </div>
    </main>
  );
}
