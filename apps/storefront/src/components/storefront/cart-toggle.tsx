"use client";

import { ShoppingBagIcon } from "@repo/ui/icons";

import { useCartQuery } from "@/hooks/use-cart";
import { useCartStore } from "@/hooks/use-cart-store";

export function CartToggle() {
  const openDrawer = useCartStore((s) => s.openDrawer);
  const { data: cart } = useCartQuery();
  const count = cart?.item_count ?? 0;

  return (
    <button
      onClick={openDrawer}
      className="relative text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Open cart"
    >
      <ShoppingBagIcon className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
