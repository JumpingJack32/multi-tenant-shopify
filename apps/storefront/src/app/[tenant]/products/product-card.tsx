"use client";

import type { StorefrontProductResponse } from "@repo/codegen/client/types.gen";
import { formatCents } from "@repo/shared-utils/currency";
import { motion, AnimatePresence } from "@repo/ui/components/motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StorefrontImage } from "@/components/storefront/storefront-image";
import { useTenantStore } from "@/hooks/use-tenant-store";

interface Props {
  product: StorefrontProductResponse;
  tenantSlug: string;
}

export function ProductCard({ product, tenantSlug }: Props) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const currency = useTenantStore((s) => s.currency);
  const images = product.images ?? [];
  const primaryImage = images[0]?.url;
  const secondaryImage = images[1]?.url;
  const hasSinglePrice = product.min_price === product.max_price;

  const handleClick = () => {
    router.push(`/${tenantSlug}/products/${product.slug}`);
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
      className="cursor-pointer group"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted rounded-lg">
        {primaryImage ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={isHovered && secondaryImage ? "secondary" : "primary"}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StorefrontImage
                src={
                  isHovered && secondaryImage ? secondaryImage : primaryImage
                }
                alt={product.name}
                variant="plp"
                className="object-cover w-full h-full"
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-muted-foreground">
            {product.name}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1 px-1">
        <h3 className="line-clamp-2 font-semibold text-sm">{product.name}</h3>
        <p className="font-mono text-sm">
          {hasSinglePrice
            ? formatCents(product.min_price, currency)
            : `${formatCents(product.min_price, currency)} – ${formatCents(product.max_price, currency)}`}
        </p>
      </div>
    </div>
  );
}
