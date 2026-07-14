"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@repo/shared-utils/currency";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Loader2Icon, MinusIcon, PlusIcon, Trash2Icon } from "@repo/ui/icons";

import {
  useCartQuery,
  useCheckout,
  useClearCart,
  useRemoveFromCart,
  useUpdateQuantity,
} from "@/hooks/use-cart";
import { useCartStore } from "@/hooks/use-cart-store";
import { useTenantStore } from "@/hooks/use-tenant-store";

export function CartDrawer() {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const cartId = useCartStore((s) => s.cartId);
  const isOpen = useCartStore((s) => s.isDrawerOpen);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const currency = useTenantStore((s) => s.currency);
  const { data: cart, isLoading, isFetching } = useCartQuery();
  const { mutate: updateQty, isPending: isUpdating } = useUpdateQuantity();
  const { mutate: removeItem } = useRemoveFromCart();
  const { mutate: clear } = useClearCart();
  const checkoutMutation = useCheckout();

  const items = cart?.items ?? [];
  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;

  const handleCheckout = () => {
    if (!cartId) return;
    closeDrawer();
    checkoutMutation.mutate(
      { cartId, customer_email: email || undefined },
      {
        onSuccess: (order) => {
          router.push(`/${tenant}/order-confirmation/${order.id}`);
        },
      },
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>
            {isLoading
              ? "Cart"
              : `Cart (${itemCount} item${itemCount !== 1 ? "s" : ""})`}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <p>Your cart is empty.</p>
            <Link
              href={`/${tenant}/products`}
              onClick={closeDrawer}
              className="text-sm underline hover:text-foreground"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 border-b border-border pb-4"
                >
                  {item.image_url && (
                    <div className="w-16 h-20 rounded bg-muted overflow-hidden shrink-0">
                      <img
                        src={item.image_url}
                        alt={item.product_name ?? ""}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.product_name}
                    </p>
                    {item.variant_name && (
                      <p className="text-xs text-muted-foreground">
                        {item.variant_name}
                      </p>
                    )}
                    <p className="text-sm font-mono mt-1">
                      {formatCents(item.price, currency)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (item.quantity <= 1) {
                            removeItem(item.id);
                          } else {
                            updateQty({
                              itemId: item.id,
                              quantity: item.quantity - 1,
                            });
                          }
                        }}
                        disabled={isUpdating}
                        className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-50"
                      >
                        <MinusIcon className="h-3 w-3" />
                      </button>
                      <span className="text-sm w-6 text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQty({
                            itemId: item.id,
                            quantity: item.quantity + 1,
                          })
                        }
                        disabled={isUpdating}
                        className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-50"
                      >
                        <PlusIcon className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm font-mono whitespace-nowrap">
                    {formatCents(item.price * item.quantity, currency)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-semibold text-base">
                  {isFetching ? (
                    <Loader2Icon className="h-4 w-4 animate-spin inline" />
                  ) : (
                    formatCents(total, currency)
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping & taxes calculated at checkout.
              </p>
              <div>
                <label
                  htmlFor="drawer-email"
                  className="text-xs text-muted-foreground"
                >
                  Email (for order updates)
                </label>
                <input
                  id="drawer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-transparent mt-1"
                />
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending}
                className="w-full bg-primary text-primary-foreground py-3 rounded font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {checkoutMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "CHECKOUT"
                )}
              </button>
              <button
                onClick={closeDrawer}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => cartId && clear(cartId)}
                className="w-full py-1 text-xs text-muted-foreground hover:text-destructive transition-colors underline"
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
