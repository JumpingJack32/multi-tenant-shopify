"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCents } from "@repo/shared-utils/currency";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

import { useTenantStore } from "@/hooks/use-tenant-store";

interface SubscriptionSelectorProps {
  tenantSlug: string;
  productId: string;
  basePrice: number;
  selectedPlanId: string | null;
  onPlanChange: (planId: string | null) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function SubscriptionSelector({
  tenantSlug,
  productId,
  basePrice,
  selectedPlanId,
  onPlanChange,
}: SubscriptionSelectorProps) {
  const currency = useTenantStore((s) => s.currency);

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans", productId],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/products/${productId}/subscription-plans`);
      return r.json();
    },
  });

  const planList = (plans ?? []) as Array<{
    id: string;
    interval: string;
    interval_count: number;
    discount_percentage: number;
  }>;

  if (planList.length === 0) return null;

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Purchase Options
      </p>

      <label className="flex items-center gap-3 p-3 rounded border border-border has-[:checked]:border-primary cursor-pointer">
        <input
          type="radio"
          name="purchase-type"
          checked={!selectedPlanId}
          onChange={() => onPlanChange(null)}
          className="accent-primary"
        />
        <div>
          <p className="text-sm font-medium">One-time purchase</p>
          <p className="text-xs text-muted-foreground">{formatCents(basePrice, currency)}</p>
        </div>
      </label>

      {planList.map((plan) => {
        const discounted = Math.round(basePrice * (1 - plan.discount_percentage / 100));
        return (
          <label
            key={plan.id}
            className="flex items-center gap-3 p-3 rounded border border-border has-[:checked]:border-primary cursor-pointer"
          >
            <input
              type="radio"
              name="purchase-type"
              checked={selectedPlanId === plan.id}
              onChange={() => onPlanChange(plan.id)}
              className="accent-primary"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Subscribe & Save {plan.discount_percentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCents(discounted, currency)} / {plan.interval_count > 1 ? `every ${plan.interval_count} ${plan.interval.toLowerCase()}s` : `per ${plan.interval.toLowerCase()}`}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
