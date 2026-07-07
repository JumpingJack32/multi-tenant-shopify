"use client";

import type { Product } from "@repo/tenant-orm/types";
import { motion, AnimatePresence } from "@repo/ui/components/motion";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

import { StorefrontImage } from "@/components/storefront/storefront-image";

interface ProductCardProps {
  product: Product;
  categorySlug: string;
}

export function ProductCard({ product, categorySlug }: ProductCardProps) {
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;
  const [isHovered, setIsHovered] = useState(false);

  const primaryImage = product.images?.[0]?.url;
  const secondaryImage = product.images?.[1]?.url;

  const handleClick = () => {
    router.push(`/${tenant}/shop/${categorySlug}/${product.slug}`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="cursor-pointer"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-black">
        {primaryImage ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={
                isHovered && secondaryImage != null ? "secondary" : "primary"
              }
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StorefrontImage
                src={
                  isHovered && secondaryImage != null
                    ? secondaryImage
                    : primaryImage
                }
                alt={product.name}
                variant="plp"
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-muted-foreground">
            {product.name}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="line-clamp-2 font-semibold">{product.name}</h3>
        {product.price != null && (
          <p className="font-mono">£{product.price.toFixed(2)}</p>
        )}
      </div>
    </div>
  );
}
