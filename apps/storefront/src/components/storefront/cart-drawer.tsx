"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
import { fetchShippingInfo, validatePromoCode } from "@/lib/storefront-api";

export function CartDrawer() {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const cartId = useCartStore((s) => s.cartId);
  const isOpen = useCartStore((s) => s.isDrawerOpen);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const currency = useTenantStore((s) => s.currency);
  const { data: cart, isLoading, isFetching } = useCartQuery();
  const { mutate: updateQty, isPending: isUpdating } = useUpdateQuantity();
  const { mutate: removeItem } = useRemoveFromCart();
  const { mutate: clear } = useClearCart();
  const clearError = useCallback(() => setCheckoutError(null), []);
  const checkoutMutation = useCheckout();

  const { data: shippingInfo } = useQuery({
    queryKey: ["shipping-info", tenant],
    queryFn: () => fetchShippingInfo(tenant),
    enabled: !!tenant,
    staleTime: 5 * 60 * 1000,
  });

  const items = cart?.items ?? [];
  const itemCount = cart?.item_count ?? 0;
  const total = cart?.total ?? 0;
  const taxTotal = (cart as any)?.tax_total ?? 0;
  const subtotal = total - taxTotal;

  const threshold = shippingInfo?.free_shipping_threshold;
  const thresholdCents = threshold ? Math.round(threshold * 100) : null;
  const progress = thresholdCents && thresholdCents > 0 ? Math.min(subtotal / thresholdCents, 1) : 1;
  const remaining = thresholdCents ? Math.max(0, thresholdCents - subtotal) : 0;
  const showFreeShipping = thresholdCents !== null && thresholdCents > 0;

  const handleCheckout = () => {
    if (!cartId) return;
    setCheckoutError(null);
    checkoutMutation.mutate(
      { cartId, customer_email: email || undefined } as Parameters<
        typeof checkoutMutation.mutate
      >[0],
      {
        onSuccess: (order) => {
          closeDrawer();
          router.push(`/${tenant}/order-confirmation/${order.id}`);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
          setCheckoutError(msg);
        },
      },
    );
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoMessage("");
    const result = await validatePromoCode(tenant, promoCode, subtotal);
    setPromoLoading(false);
    if (result.valid && result.discount) {
      setPromoDiscount(result.discount);
      setPromoMessage(result.message ?? "Promo applied");
    } else {
      setPromoDiscount(0);
      setPromoMessage(result.message ?? "Invalid code");
    }
  };

  const handleClearPromo = () => {
    setPromoCode("");
    setPromoDiscount(0);
    setPromoMessage("");
  };

  const handleRetry = () => {
    setCheckoutError(null);
    checkoutMutation.reset();
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
                          clearError();
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
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-50"
                        aria-label="Decrease quantity"
                      >
                        <MinusIcon className="h-3 w-3" />
                      </button>
                      <span className="text-sm w-6 text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        data-testid="cart-quantity-plus"
                        onClick={() => {
                          clearError();
                          updateQty({
                            itemId: item.id,
                            quantity: item.quantity + 1,
                          });
                        }}
                        disabled={isUpdating}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-50"
                        aria-label="Increase quantity"
                      >
                        <PlusIcon className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          clearError();
                          removeItem(item.id);
                        }}
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Remove item"
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

              {/* Free shipping progress bar */}
              {showFreeShipping && subtotal > 0 && (
                <div className="space-y-1.5" aria-live="polite" aria-atomic="true">
                  {progress >= 1 ? (
                    <p className="text-xs font-medium text-green-600">
                      You've unlocked FREE shipping!
                    </p>
                  ) : (
                    <>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(progress * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add {formatCents(remaining, currency)} more for FREE shipping
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Promo code */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Promo code"
                  className="flex-1 border border-border rounded-sm px-3 py-2 text-sm bg-transparent"
                />
                {promoDiscount > 0 ? (
                  <button onClick={handleClearPromo} className="text-xs text-destructive underline whitespace-nowrap min-h-[44px]" aria-label="Remove promo code">
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                    className="text-xs font-medium text-primary underline whitespace-nowrap disabled:opacity-50 min-h-[44px]"
                    aria-label="Apply promo code"
                  >
                    {promoLoading ? "..." : "Apply"}
                  </button>
                )}
              </div>
              {promoMessage && (
                <p className={`text-xs ${promoDiscount > 0 ? "text-green-600" : "text-destructive"}`} aria-live="polite" aria-atomic="true">
                  {promoMessage}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-semibold text-base">
                  {isFetching ? (
                    <Loader2Icon className="h-4 w-4 animate-spin inline" />
                  ) : (
                    formatCents(subtotal, currency)
                  )}
                </span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Discount</span>
                  <span className="font-mono text-green-600">-{formatCents(promoDiscount, currency)}</span>
                </div>
              )}
              {taxTotal > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono text-base">
                    {formatCents(taxTotal, currency)}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {taxTotal > 0
                  ? "Shipping calculated at checkout"
                  : "Shipping & taxes calculated at checkout"}
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
              {checkoutError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-xs text-destructive space-y-2">
                  <p>{checkoutError}</p>
                  <button
                    onClick={handleRetry}
                    className="underline hover:text-destructive/80"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending}
                className="w-full bg-primary text-primary-foreground min-h-[44px] rounded font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {checkoutMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "CHECKOUT"
                )}
              </button>
              <button
                onClick={closeDrawer}
                className="w-full min-h-[44px] text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => cartId && clear(cartId)}
                className="w-full min-h-[44px] text-xs text-muted-foreground hover:text-destructive transition-colors underline"
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
