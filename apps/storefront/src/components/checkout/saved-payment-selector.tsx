"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "@repo/ui/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface SavedPaymentSelectorProps {
  tenantSlug: string;
  customerEmail: string;
  selectedId?: string;
  onSelect: (method: PaymentMethod | null) => void;
}

export function SavedPaymentSelector({ tenantSlug, customerEmail, selectedId, onSelect }: SavedPaymentSelectorProps) {
  const { data: methods, isLoading } = useQuery({
    queryKey: ["payment-methods", tenantSlug, customerEmail],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/payment-methods?customer_email=${encodeURIComponent(customerEmail)}`);
      return r.json();
    },
    enabled: !!customerEmail,
  });

  const list = (methods ?? []) as PaymentMethod[];

  if (isLoading) return <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (list.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Cards</p>
      {list.map((pm) => (
        <label key={pm.id} className="flex items-center gap-2 p-2 rounded border border-border has-[:checked]:border-primary cursor-pointer">
          <input
            type="radio"
            name="payment-method"
            checked={selectedId === pm.id}
            onChange={() => onSelect(pm)}
            className="accent-primary"
          />
          <div className="text-sm">
            <span className="font-medium capitalize">{pm.brand}</span>
            <span className="font-mono text-muted-foreground ml-1">•••• {pm.last4}</span>
            <span className="text-xs text-muted-foreground ml-2">Exp {pm.exp_month}/{String(pm.exp_year).slice(-2)}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
