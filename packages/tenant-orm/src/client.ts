import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TenantClient {
  tenantId: string;
  db: SupabaseClient;
  withTenantScope(): SupabaseClient;
}

export function createTenantClient(
  supabaseUrl: string,
  supabaseKey: string,
): TenantClient {
  const db = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {},
    },
  });

  return {
    tenantId: "",
    db,
    withTenantScope(): SupabaseClient {
      return createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            "X-Tenant-ID": this.tenantId,
          },
        },
        db: {
          customFetch: fetch,
        },
        auth: {
          persistSession: false,
        },
      });
    },
  };
}
