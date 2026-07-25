"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { StorefrontProductResponse } from "@repo/codegen/client/types.gen";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

import { ProductCard } from "@/app/[tenant]/products/product-card";

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name", label: "Name: A to Z" },
];

interface ProductListingProps {
  initialProducts: StorefrontProductResponse[];
  tenant: string;
  categorySlug?: string;
}

export function ProductListing({ initialProducts, tenant }: ProductListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") || "newest";

  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const sorted = useMemo(() => {
    const copy = [...initialProducts];
    switch (sort) {
      case "price_asc":
        return copy.sort((a, b) => a.min_price - b.min_price);
      case "price_desc":
        return copy.sort((a, b) => b.min_price - a.min_price);
      case "name":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return copy;
    }
  }, [initialProducts, sort]);

  const visible = sorted.slice(0, displayCount);
  const hasMore = displayCount < sorted.length;

  const handleSortChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Showing {visible.length} of {sorted.length} product{sorted.length !== 1 ? "s" : ""}
        </p>
        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">No products match your selection</p>
          <Link
            href={`/${tenant}/products`}
            className="text-sm font-medium underline underline-offset-4 hover:text-foreground"
          >
            View all products
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                tenantSlug={tenant}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-10">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
