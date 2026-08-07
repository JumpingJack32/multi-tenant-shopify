"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

interface PermissionCatalog {
  permission_keys: string[];
  role_permissions: Record<string, string[]>;
  my_permissions: string[];
  my_role: string;
}

interface RbacContextValue {
  role: string;
  permissions: string[];
  can: (permission: string) => boolean;
  isSuperuser: boolean;
  loading: boolean;
  refresh: () => void;
}

const RbacContext = createContext<RbacContextValue | null>(null);

export function RbacProvider({ children }: { children: ReactNode }) {
  const { currentTenantId } = useTenantContext();
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useMemo(
    () => async () => {
      if (!currentTenantId) return;
      setLoading(true);
      try {
        const data = await request<PermissionCatalog>("/admin/permissions", {
          tenantId: currentTenantId,
        });
        setCatalog(data);
      } catch {
        setCatalog(null);
      } finally {
        setLoading(false);
      }
    },
    [currentTenantId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<RbacContextValue>(() => {
    const perms = catalog?.my_permissions ?? [];
    const role = catalog?.my_role ?? "viewer";
    return {
      role,
      permissions: perms,
      can: (permission: string) => perms.includes(permission),
      isSuperuser: role === "superuser",
      loading,
      refresh: () => load(),
    };
  }, [catalog, loading, load]);

  return (
    <RbacContext.Provider value={value}>
      {children}
    </RbacContext.Provider>
  );
}

export function useRbac(): RbacContextValue {
  const context = useContext(RbacContext);
  if (!context) {
    throw new Error("useRbac must be used within a RbacProvider");
  }
  return context;
}
