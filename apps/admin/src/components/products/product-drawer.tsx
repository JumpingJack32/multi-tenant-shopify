"use client";

import type { Product } from "@repo/tenant-orm/types";

import { Drawer } from "@/components/ui/drawer";

import { ImageManager } from "./image-manager";
import { ProductForm } from "./product-form";

interface ProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function ProductDrawer({
  open,
  onOpenChange,
  product,
  onSubmit,
}: ProductDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={product ? "Edit Product" : "Create Product"}
      size="md"
    >
      <ProductForm
        initialData={product ?? undefined}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
      {product && (
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Product Images</h3>
          <ImageManager
            productId={product.id}
            images={product.images ?? []}
            onImagesChange={() => {
              // ImageManager is self-contained — parent re-render not required
            }}
          />
        </div>
      )}
    </Drawer>
  );
}
