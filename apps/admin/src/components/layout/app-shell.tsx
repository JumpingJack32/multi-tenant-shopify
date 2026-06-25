"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { TenantProvider } from "@/contexts/tenant-context";
import { RbacProvider } from "@/contexts/rbac-context";

const queryClient = new QueryClient();

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <RbacProvider>
          <div className="flex h-screen flex-col">
            <Header />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </RbacProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
}
