"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { GlobeIcon } from "@repo/ui/icons";

import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

interface AllTenant {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
}

export function SuperuserTenantSwitcher() {
  const { isSuperuser } = useRbac();
  const { currentTenant, setTenant } = useTenantContext();
  const [open, setOpen] = useState(false);

  const { data: tenants = [] } = useQuery<AllTenant[]>({
    queryKey: ["admin-all-tenants"],
    queryFn: () => request<AllTenant[]>("/admin/tenants"),
    enabled: isSuperuser,
  });

  useEffect(() => {
    if (!isSuperuser) setOpen(false);
  }, [isSuperuser]);

  if (!isSuperuser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Switch tenant (superuser)"
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        <span className="max-w-24 truncate">{currentTenant?.slug ?? "Switch"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-80 w-56 overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTenant(t.tenant_id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 text-muted-foreground">{t.slug}</span>
              </button>
            ))}
            {tenants.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No tenants</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
