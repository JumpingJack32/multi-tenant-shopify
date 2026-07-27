"use client";

import { useQuery } from "@tanstack/react-query";
import type { StorefrontProductResponse } from "@repo/codegen/client/types.gen";
import { formatCents } from "@repo/shared-utils/currency";

import { useTenantStore } from "@/hooks/use-tenant-store";
import { fetchShippingInfo } from "@/lib/storefront-api";

interface ShippingEstimatorProps {
  tenantSlug: string;
  product: StorefrontProductResponse;
}

export function ShippingEstimator({ tenantSlug }: ShippingEstimatorProps) {
  const currency = useTenantStore((s) => s.currency);

  const { data: info } = useQuery({
    queryKey: ["shipping-info", tenantSlug],
    queryFn: () => fetchShippingInfo(tenantSlug),
    enabled: !!tenantSlug,
    staleTime: 5 * 60 * 1000,
  });

  if (!info || info.methods.length === 0) return null;

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Shipping
      </p>
      {info.methods.map((method) => (
        <div key={method.name} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{method.name}</span>
          <span className="font-mono">
            {method.rate_type === "THRESHOLD" && info.free_shipping_threshold
              ? "FREE"
              : formatCents(Math.round(method.base_price * 100), currency)}
          </span>
        </div>
      ))}
      {info.free_shipping_threshold && (
        <p className="text-xs text-muted-foreground pt-1">
          FREE shipping on orders over {formatCents(Math.round(info.free_shipping_threshold * 100), currency)}
        </p>
      )}
    </div>
  );
}
