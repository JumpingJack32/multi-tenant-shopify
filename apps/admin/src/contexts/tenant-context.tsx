"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface TenantInfo {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deleted";
}

interface TenantContextValue {
  currentTenantId: string | null;
  currentTenant: TenantInfo | null;
  tenantList: TenantInfo[];
  setTenant: (tenantId: string) => void;
  isLoading: boolean;
  networkError: boolean;
  retry: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const STORAGE_KEY = "admin_selected_tenant";

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantList, setTenantList] = useState<TenantInfo[]>([]);
  const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setCurrentTenantId(saved);
    }
  }, []);

  // useEffect(() => {
  //   let mounted = true;

  //   async function fetchTenants() {
  //     try {
  //       const token = await (async () => {
  //         const { getToken } = await import("@clerk/nextjs");
  //         return getToken();
  //       })();

  //       const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  //       const response = await fetch(`${API_BASE}/tenants`, {
  //         headers: token ? { Authorization: `Bearer ${token}` } : {},
  //       });

  //       if (response.ok && mounted) {
  //         const data: TenantInfo[] = await response.json();
  //         setTenantList(data);

  //         if (data.length > 0) {
  //           const saved = sessionStorage.getItem(STORAGE_KEY);
  //           const active = saved && data.some((t) => t.id === saved)
  //             ? data.find((t) => t.id === saved)!
  //             : data[0];
  //           setCurrentTenant(active!);
  //           setCurrentTenantId(active!.id);
  //           sessionStorage.setItem(STORAGE_KEY, active!.id);
  //         }
  //       }
  //     } catch {
  //       setTenantList([]);
  //     } finally {
  //       if (mounted) setIsLoading(false);
  //     }
  //   }

  //   fetchTenants();
  //   return () => { mounted = false; };
  // }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchTenants = async () => {
      try {
        // 1. Cleanly await the dynamic import
        const { getToken } = await import("@clerk/nextjs");
        const token = await getToken();

        const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1`;
        const response = await fetch(`${API_BASE}/tenants`, {
          // 2. Use `undefined` instead of an empty object `{}` when no token exists
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        // 3. Early return if the request failed or the component unmounted
        if (!response.ok || !isMounted) return;

        // const tenants: TenantInfo[] = await response.json();
        const tenants = (await response.json()) as TenantInfo[];
        setTenantList(tenants);

        // 4. Simplified active tenant logic (no more non-null assertions `!`)
        if (tenants.length > 0) {
          const savedId = sessionStorage.getItem(STORAGE_KEY);
          const activeTenant =
            (savedId &&
              tenants.find(
                (t) => t.tenant_id === savedId || t.id === savedId,
              )) ||
            tenants[0];

          if (activeTenant) {
            setCurrentTenant(activeTenant);
            setCurrentTenantId(activeTenant.tenant_id);
            sessionStorage.setItem(STORAGE_KEY, activeTenant.tenant_id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tenants:", error);
        if (isMounted) {
          setTenantList([]);
          setNetworkError(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTenants();

    return () => {
      isMounted = false;
    };
  }, []);

  const retry = useCallback(() => {
    setNetworkError(false);
    setIsLoading(true);
    // Re-trigger by forcing isLoading to reset — the effect can't be re-run,
    // so reload the page as the simplest reliable recovery
    window.location.reload();
  }, []);

  const setTenant = useCallback(
    (tenantId: string) => {
      const tenant = tenantList.find(
        (t) => t.tenant_id === tenantId || t.id === tenantId,
      );
      if (tenant) {
        setCurrentTenant(tenant);
        setCurrentTenantId(tenant.tenant_id);
        sessionStorage.setItem(STORAGE_KEY, tenant.tenant_id);
      }
    },
    [tenantList],
  );

  return (
    <TenantContext.Provider
      value={{
        currentTenantId,
        currentTenant,
        tenantList,
        setTenant,
        isLoading,
        networkError,
        retry,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenantContext must be used within a TenantProvider");
  }
  return context;
}
