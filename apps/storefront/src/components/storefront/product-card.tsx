"use client";

import { useState } from "react";
import { motion } from "@repo/ui/components/motion";
import { useRouter, useParams } from "next/navigation";
import type { Product } from "@repo/tenant-orm/types";

interface ProductCardProps {
  product: Product;
  categorySlug: string;
}

export function ProductCard({ product, categorySlug }: ProductCardProps) {
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;
  const [isHovered, setIsHovered] = useState(false);

  const hasSecondary = product.images != null && product.images.length > 1;
  const primaryImage = product.images?.[0];
  const secondaryImage = hasSecondary ? product.images![1] : null;

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
          <>
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: !isHovered || !hasSecondary ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <img
                src={primaryImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </motion.div>
            {hasSecondary && secondaryImage && (
              <motion.div
                className="absolute inset-0"
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={secondaryImage}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </motion.div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-muted-foreground">
            {product.name}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="line-clamp-2 font-semibold">{product.name}</h3>
        {product.price != null && (
          <p className="font-mono">£{(product.price / 100).toFixed(2)}</p>
        )}
      </div>
    </div>
  );
}
