"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StorefrontProductResponse } from "@repo/codegen/client/types.gen";
import { formatCents } from "@repo/shared-utils/currency";
import { motion, AnimatePresence } from "@repo/ui/components/motion";
import { HeartIcon, ShoppingBagIcon } from "@repo/ui/icons";

import { StorefrontImage } from "@/components/storefront/storefront-image";
import { useAddToCart } from "@/hooks/use-cart";
import { useTenantStore } from "@/hooks/use-tenant-store";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: StorefrontProductResponse;
  tenantSlug: string;
  index?: number;
}

function Stars({ value }: { value: number }) {
  if (!value || value <= 0) return null;
  const full = Math.floor(value);
  return (
    <div className="flex items-center gap-0.5 text-sm text-amber-500" aria-label={`${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i}>{i < full ? "★" : "☆"}</span>
      ))}
    </div>
  );
}

export function ProductCard({ product, tenantSlug, index = 0 }: ProductCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isFav, setIsFav] = useState(false);

  const currency = useTenantStore((s) => s.currency);
  const { mutate: addToCart, isPending } = useAddToCart();

  const images = product.images ?? [];
  const primaryImage = images[0]?.url;
  const secondaryImage = images[1]?.url;
  const hasSinglePrice = product.min_price === product.max_price;
  const firstVariant =
    product.variants?.find((v) => v.is_active && v.in_stock) ??
    product.variants?.[0];
  const avgRating = (product as unknown as { avg_rating?: number }).avg_rating ?? 0;
  const reviewCount =
    (product as unknown as { review_count?: number }).review_count ?? 0;

  const handleClick = () => {
    router.push(`/${tenantSlug}/products/${product.slug}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (firstVariant?.id) {
      addToCart({ variantId: firstVariant.id, quantity: 1 });
    }
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFav((prev) => !prev);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <div
        role="link"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border/40 bg-background shadow-sm transition-shadow duration-300 hover:shadow-md"
      >
        {/* Media */}
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
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
                  src={isHovered && secondaryImage ? secondaryImage : primaryImage}
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

          {/* Fav button */}
          <button
            onClick={handleFav}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
          >
            <HeartIcon
              className={cn("h-4 w-4", isFav && "fill-destructive text-destructive")}
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug">
            {product.name}
          </h3>

          <div className="mb-3 flex items-center gap-2">
            <Stars value={avgRating / 100} />
            {reviewCount > 0 && (
              <span className="text-xs text-muted-foreground">({reviewCount})</span>
            )}
          </div>

          <div className="mt-auto flex items-baseline gap-2">
            {hasSinglePrice ? (
              <span className="font-mono text-lg font-medium">
                {formatCents(product.min_price, currency)}
              </span>
            ) : (
              <span className="font-mono text-lg font-medium">
                {formatCents(product.min_price, currency)} –{" "}
                {formatCents(product.max_price, currency)}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 pb-4 pt-3">
          <button
            onClick={handleClick}
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            Details
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isPending || !firstVariant?.id}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ShoppingBagIcon className="h-3.5 w-3.5" />
            {isPending ? "Adding…" : "Add to Cart"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
