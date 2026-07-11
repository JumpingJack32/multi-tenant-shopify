"use client";

import type { StorefrontProductResponse } from "@repo/codegen/client/types.gen";
import { formatCents } from "@repo/shared-utils/currency";
import { useState } from "react";

import { AddToCartVariantButton } from "@/components/storefront/add-to-cart-button";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { useTenantStore } from "@/hooks/use-tenant-store";

interface ProductDetailProps {
  product: StorefrontProductResponse;
  tenantSlug: string;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const variants = product.variants ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants.find((v) => v.in_stock)?.id ?? variants[0]?.id ?? null,
  );

  const currency = useTenantStore((s) => s.currency);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const displayPrice = selectedVariant?.price ?? product.min_price;
  const inStock = selectedVariant?.in_stock ?? false;

  const primaryImage = product.images?.[0]?.url;
  const allImages = product.images?.slice(1) ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4 pb-8">
      <div className="space-y-4">
        {primaryImage && (
          <div className="aspect-[4/5] overflow-hidden bg-muted rounded-lg">
            <StorefrontImage
              src={primaryImage}
              alt={product.name}
              variant="pdpHero"
              className="object-cover w-full h-full"
            />
          </div>
        )}
        {allImages.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {allImages.map((img) => (
              <div
                key={img.id}
                className="aspect-[4/5] overflow-hidden bg-muted rounded-lg"
              >
                <StorefrontImage
                  src={img.url}
                  alt={img.alt_text ?? product.name}
                  variant="pdpDetail"
                  className="object-cover w-full h-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-2xl font-mono">
            {formatCents(displayPrice, currency)}
          </p>
        </div>

        {variants.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-3">OPTIONS</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const optValue = Object.values(v.options)[0] ?? v.sku;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    disabled={!v.in_stock}
                    className={`px-4 py-2 text-sm rounded border transition-colors ${
                      selectedVariantId === v.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : v.in_stock
                          ? "border-border hover:border-foreground"
                          : "border-border opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {String(optValue)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedVariantId && inStock ? (
          <AddToCartVariantButton variantId={selectedVariantId} />
        ) : (
          <button
            disabled
            className="w-full bg-primary text-primary-foreground py-4 px-6 font-semibold text-lg rounded opacity-50"
          >
            OUT OF STOCK
          </button>
        )}

        {product.description && (
          <div className="pt-4 border-t border-border">
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
