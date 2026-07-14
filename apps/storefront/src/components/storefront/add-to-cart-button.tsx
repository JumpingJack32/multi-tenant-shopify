"use client";

import { useState } from "react";
import type { Product } from "@repo/tenant-orm/types";

import { useAddToCart, useCart } from "@/hooks/use-cart";
import { useCartStore } from "@/hooks/use-cart-store";

// Legacy add-to-cart button — used by old shop/[category]/[slug] routes with in-memory cart
interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const handleClick = () => {
    addItem(
      product.id,
      product.name,
      product.price ?? 0,
      product.images?.[0]?.url ?? "",
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      disabled={added}
      className="w-full bg-primary text-primary-foreground py-4 px-6 font-semibold text-lg disabled:opacity-70"
    >
      {added ? "Added!" : "ADD TO CART"}
    </button>
  );
}

// New add-to-cart button — used by new products/[slug] routes with API-backed cart
interface AddToCartVariantProps {
  variantId: string;
  label?: string;
  className?: string;
}

export function AddToCartVariantButton({
  variantId,
  label = "ADD TO CART",
  className,
}: AddToCartVariantProps) {
  const [added, setAdded] = useState(false);
  const { mutateAsync: addToCart, isPending } = useAddToCart();
  const isProcessing = useCartStore((s) => s.isProcessing);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const handleClick = async () => {
    await addToCart({ variantId, quantity: 1 });
    setAdded(true);
    openDrawer();
    setTimeout(() => setAdded(false), 1500);
  };

  const busy = isPending || isProcessing;

  return (
    <button
      onClick={handleClick}
      disabled={busy || added}
      className={
        className ??
        "w-full bg-primary text-primary-foreground py-4 px-6 font-semibold text-lg disabled:opacity-70"
      }
    >
      {added ? "Added!" : busy ? "Adding..." : label}
    </button>
  );
}
