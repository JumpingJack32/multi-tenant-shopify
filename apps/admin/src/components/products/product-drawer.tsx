"use client";

import { Drawer } from "@/components/ui/drawer";
import { ProductForm } from "./product-form";
import type { Product } from "@repo/tenant-orm/types";

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
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) onOpenChange(false);
      }}
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
