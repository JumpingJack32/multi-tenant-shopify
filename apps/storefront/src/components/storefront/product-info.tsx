"use client";

import { AddToCartButton } from "./add-to-cart-button";
import type { Product } from "@repo/tenant-orm/types";

interface ProductInfoProps {
  product: Product;
}

const sizes = ["S", "M", "L", "XL"];

export function ProductInfo({ product }: ProductInfoProps) {
  return (
    <div className="sticky top-24 self-start">
      <h1 className="text-2xl font-bold">{product.name}</h1>

      <div className="mt-2 text-lg" aria-label="Star rating">
        ★★★★★ (142)
      </div>

      <p className="mt-2 text-3xl font-mono">
        £{((product.price ?? 0) / 100).toFixed(2)}
      </p>

      <hr className="my-6" />

      <div>
        <p className="text-sm font-semibold mb-2">SELECT SIZE</p>
        <div className="flex gap-2">
          {sizes.map((size) => (
            <button
              key={size}
              disabled
              className="w-12 h-12 border border-muted-foreground/30 rounded text-sm opacity-50 cursor-not-allowed"
            >
              {size}
            </button>
          ))}
          <button className="w-20 h-12 border border-primary bg-primary text-primary-foreground rounded text-sm">
            ONE SIZE
          </button>
        </div>
      </div>

      <div className="mt-6">
        <AddToCartButton product={product} />
      </div>

      {product.specs && product.specs.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3">
          {product.specs.map((spec, i) => (
            <div key={i}>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {spec.label}
              </dt>
              <dd className="text-sm">{spec.value}</dd>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-between text-xs text-muted-foreground">
        <span>🚚 FREE SHIPPING</span>
        <span>🔄 30-DAY RETURNS</span>
        <span>🔒 SECURE CHECKOUT</span>
      </div>
    </div>
  );
}
