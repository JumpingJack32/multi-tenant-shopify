"use client";

import { formatCents } from "@repo/shared-utils/currency";

import {
  useCartQuery,
  useRemoveFromCart,
  useClearCart,
} from "@/hooks/use-cart";
import { useCartStore } from "@/hooks/use-cart-store";
import { useTenantStore } from "@/hooks/use-tenant-store";

export function Cart() {
  const cartId = useCartStore((s) => s.cartId);
  const currency = useTenantStore((s) => s.currency);
  const { data: cart, isLoading } = useCartQuery();
  const { mutate: removeItem } = useRemoveFromCart();
  const { mutate: clear } = useClearCart();

  if (!cartId) return null;

  const items = cart?.items ?? [];
  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card text-card-foreground border border-border rounded-lg p-4 shadow-lg max-w-sm w-full">
      <div className="font-semibold flex items-center justify-between">
        <span>
          Cart ({itemCount} item{itemCount !== 1 ? "s" : ""})
        </span>
        {itemCount > 0 && (
          <button
            onClick={() => cartId && clear(cartId)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground mt-2">Loading...</p>
      )}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          Your cart is empty.
        </p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between mt-3 gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {item.product_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {item.variant_name && <span>{item.variant_name} · </span>}
              {formatCents(item.price, currency)} x {item.quantity}
            </div>
          </div>
          <div className="text-sm font-mono whitespace-nowrap">
            {formatCents(item.price * item.quantity, currency)}
          </div>
          <button
            onClick={() => removeItem(item.id)}
            className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
          >
            Remove
          </button>
        </div>
      ))}

      {items.length > 0 && (
        <div className="border-t border-border mt-3 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span className="font-mono">{formatCents(total, currency)}</span>
        </div>
      )}
    </div>
  );
}
