import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";

export function createStorefrontWrapper() {
  return function StorefrontWrapper({ children }: { children: ReactNode }) {
    const queryClient = useMemo(() => new QueryClient(), []);
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}
