import { useQuery } from "@tanstack/react-query";
import { createTenantClient } from "@repo/tenant-orm/client";

export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const client = createTenantClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data, error } = await client.db
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
