"use client";

import { useEffect } from "react";

import { useCartStore } from "@/hooks/use-cart-store";
import { useTenantSlug } from "@/hooks/use-tenant-slug";
import { getCartId } from "@/lib/cart-cookie";

export function CartHydrator() {
  const tenantSlug = useTenantSlug();
  const setCartId = useCartStore((s) => s.setCartId);

  useEffect(() => {
    const id = getCartId(tenantSlug);
    if (id) setCartId(id);
  }, [tenantSlug, setCartId]);

  return null;
}
