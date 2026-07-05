"use client";

import { useState, useCallback } from "react";
import { useCart } from "@/hooks/use-cart";
import type { Product } from "@repo/tenant-orm/types";

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const handleClick = useCallback(() => {
    addItem(product.id, product.name, product.price ?? 0, product.images?.[0]);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }, [product, addItem]);

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
