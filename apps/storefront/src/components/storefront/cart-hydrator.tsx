"use client";

import { useEffect } from "react";

import { useCartStore } from "@/hooks/use-cart-store";
import { useTenantSlug } from "@/hooks/use-tenant-slug";
import { getCartId, removeCartId } from "@/lib/cart-cookie";
import { getCart } from "@/lib/storefront-api";

export function CartHydrator() {
  const tenantSlug = useTenantSlug();
  const setCartId = useCartStore((s) => s.setCartId);

  useEffect(() => {
    const id = getCartId(tenantSlug);
    if (id) {
      setCartId(id);
      getCart(tenantSlug, id).then((cart) => {
        if (cart?.status === "completed") {
          removeCartId(tenantSlug);
          setCartId(null);
        }
      });
    }
  }, [tenantSlug, setCartId]);

  return null;
}
