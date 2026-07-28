"use client";

import { useEffect, useState } from "react";
import type { Product } from "@repo/tenant-orm/types";
import { motion, useReducedMotion } from "@repo/ui/components/motion";

import { AddToCartButton } from "./add-to-cart-button";

interface MobileStickyCtaProps {
  product: Product;
}

export function MobileStickyCta({ product }: MobileStickyCtaProps) {
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const el = document.getElementById("pdp-inline-cta");
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry != null && !entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="lg:hidden"
      data-visible={visible}
      data-testid="sticky-cta-wrapper"
    >
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border"
        initial={{ y: prefersReducedMotion ? 0 : 80 }}
        animate={{ y: visible || prefersReducedMotion ? 0 : 80 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }}
      >
        <div className="min-h-14 px-4 flex items-center justify-between gap-4 pb-[env(safe-area-inset-bottom)]">
          {product.price != null && (
            <span className="text-sm font-text text-foreground whitespace-nowrap">
              £ {product.price.toFixed(2)}
            </span>
          )}
          <div className="w-auto shrink-0">
            <AddToCartButton product={product} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
