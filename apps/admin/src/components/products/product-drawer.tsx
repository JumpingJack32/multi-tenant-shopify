"use client";

import type { Product } from "@repo/tenant-orm/types";

import { Drawer } from "@/components/ui/drawer";

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
    </Drawer>
  );
}
