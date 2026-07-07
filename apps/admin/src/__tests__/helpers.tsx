import type { ReactNode } from "react";

import { RbacProvider } from "../contexts/rbac-context";
import { TenantProvider } from "../contexts/tenant-context";

export function createAdminWrapper() {
  return function AdminWrapper({ children }: { children: ReactNode }) {
    return (
      <RbacProvider>
        <TenantProvider>{children}</TenantProvider>
      </RbacProvider>
    );
  };
}
