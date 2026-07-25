"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { StorefrontProductResponse } from "@repo/codegen/client/types.gen";
import { formatCents } from "@repo/shared-utils/currency";

import { ProductCard } from "@/app/[tenant]/products/product-card";
import { AddToCartVariantButton } from "@/components/storefront/add-to-cart-button";
import { ImageGallery } from "@/components/storefront/image-gallery";
import { VariantSelector, type VariantWithImage } from "@/components/storefront/variant-selector";
import { useNavigation } from "@/hooks/use-navigation";
import { useTenantStore } from "@/hooks/use-tenant-store";
import { cn } from "@/lib/utils";

interface ProductDetailProps {
  product: StorefrontProductResponse;
  tenantSlug: string;
  relatedProducts?: StorefrontProductResponse[];
}

export function ProductDetail({ product, tenantSlug, relatedProducts = [] }: ProductDetailProps) {
  const variants = (product.variants ?? []) as VariantWithImage[];
  const currency = useTenantStore((s) => s.currency);

  const [selectedVariant, setSelectedVariant] = useState<VariantWithImage | null>(null);

  const handleVariantChange = useCallback(
    (v: VariantWithImage) => {
      setSelectedVariant(v);
    },
    [],
  );

  const displayPrice = selectedVariant?.price ?? product.min_price;
  const comparePrice = selectedVariant?.compare_at_price ?? undefined;
  const inStock = selectedVariant?.in_stock ?? variants.some((v) => v.in_stock);
  const hasDiscount = comparePrice && comparePrice > displayPrice;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6 pt-4">
        <Link href={`/${tenantSlug}`} className="hover:text-foreground">Home</Link>
        {product.category_slug && (
          <>
            <span className="mx-2">&gt;</span>
            <Link href={`/${tenantSlug}/${product.category_slug}`} className="hover:text-foreground capitalize">
              {product.category_slug.replace(/-/g, " ")}
            </Link>
          </>
        )}
        <span className="mx-2">&gt;</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left — Gallery */}
        <div>
          <ImageGallery images={product.images ?? []} />
        </div>

        {/* Right — Product Info */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl font-mono">
                {formatCents(displayPrice, currency)}
              </p>
              {hasDiscount && (
                <p className="text-lg font-mono text-muted-foreground line-through">
                  {formatCents(comparePrice, currency)}
                </p>
              )}
            </div>
            {selectedVariant?.sku && (
              <p className="text-xs text-muted-foreground mt-1">SKU: {selectedVariant.sku}</p>
            )}
          </div>

          {/* Variant Selector */}
          {variants.length > 0 && (
            <VariantSelector
              variants={variants}
              onVariantChange={handleVariantChange}
            />
          )}

          {/* Add to Cart / Out of Stock */}
          {selectedVariant?.id && inStock ? (
            <AddToCartVariantButton variantId={selectedVariant.id} />
          ) : (
            <button
              disabled
              className="w-full bg-primary text-primary-foreground py-4 px-6 font-semibold text-lg rounded opacity-50 cursor-not-allowed"
            >
              OUT OF STOCK
            </button>
          )}

          {/* Shipping note */}
          <div className="text-sm text-muted-foreground space-y-1">
            {inStock && <p>✓ In stock — ships within 24 hours</p>}
            <p>✓ Free 30-day returns</p>
          </div>

          {/* Description */}
          {product.description && (
            <details className="group border-t border-border pt-4">
              <summary className="text-sm font-semibold cursor-pointer list-none flex items-center justify-between">
                Product Description
                <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </details>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-6">Complete the Look</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((rp) => (
              <ProductCard key={rp.id} product={rp} tenantSlug={tenantSlug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
