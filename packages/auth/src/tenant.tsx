import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface TenantContextValue {
  tenantId: string | null;
  setTenantId: (id: string | null) => void;
  activeTenant: { id: string; name: string; slug: string } | null;
  setActiveTenant: (tenant: { id: string; name: string; slug: string } | null) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [activeTenant, setActiveTenant] = useState<TenantContextValue["activeTenant"]>(null);

  return (
    <TenantContext value={{ tenantId, setTenantId, activeTenant, setActiveTenant }}>
      {children}
    </TenantContext>
  );
}

export function useTenantId() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenantId must be used within a TenantProvider");
  }
  return ctx.tenantId;
}

export function useActiveTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useActiveTenant must be used within a TenantProvider");
  }
  return ctx.activeTenant;
}

export function useSetTenantId() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useSetTenantId must be used within a TenantProvider");
  }
  return ctx.setTenantId;
}
