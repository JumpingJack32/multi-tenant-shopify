import { createTenantClient } from "@repo/tenant-orm/client";
import type { Product, ProductCreate, ProductUpdate } from "@repo/tenant-orm/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ProductsResponse {
  data: Product[];
  total: number;
}

export async function fetchProducts(params?: {
  search?: string;
  page?: string;
  limit?: string;
}): Promise<ProductsResponse> {
  const tenantId = typeof window !== "undefined"
    ? sessionStorage.getItem("admin_selected_tenant")
    : null;

  if (!tenantId) {
    return { data: [], total: 0 };
  }

  const client = createTenantClient(SUPABASE_URL, SUPABASE_KEY);
  const scoped = client.withTenantScope();

  let query = scoped.from("products").select("*", { count: "exact" });

  if (params?.search) {
    query = query.ilike("name", `%${params.search}%`);
  }

  const from = params?.page ? String((parseInt(params.page) - 1) * (parseInt(params.limit || "20"))) : "0";
  const to = params?.limit ? String(parseInt(from) + parseInt(params.limit) - 1) : "29";

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: (data ?? []) as Product[],
    total: count ?? 0,
  };
}

export async function createProduct(data: ProductCreate): Promise<Product> {
  const tenantId = typeof window !== "undefined"
    ? sessionStorage.getItem("admin_selected_tenant")
    : null;

  if (!tenantId) {
    throw new Error("No tenant selected");
  }

  const client = createTenantClient(SUPABASE_URL, SUPABASE_KEY);
  const scoped = client.withTenantScope();

  const { data: product, error } = await scoped
    .from("products")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return product as Product;
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product> {
  const tenantId = typeof window !== "undefined"
    ? sessionStorage.getItem("admin_selected_tenant")
    : null;

  if (!tenantId) {
    throw new Error("No tenant selected");
  }

  const client = createTenantClient(SUPABASE_URL, SUPABASE_KEY);
  const scoped = client.withTenantScope();

  const { data: product, error } = await scoped
    .from("products")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return product as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const tenantId = typeof window !== "undefined"
    ? sessionStorage.getItem("admin_selected_tenant")
    : null;

  if (!tenantId) {
    throw new Error("No tenant selected");
  }

  const client = createTenantClient(SUPABASE_URL, SUPABASE_KEY);
  const scoped = client.withTenantScope();

  const { error } = await scoped
    .from("products")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
