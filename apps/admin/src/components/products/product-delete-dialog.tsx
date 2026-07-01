"use client";

import type { Product } from "@repo/tenant-orm/types";
import { AlertDialog } from "@repo/ui/base-ui";

import { Button } from "@/components/ui/button";

interface ProductDeleteDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirmLoading?: boolean;
}

export function ProductDeleteDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
  confirmLoading = false,
}: ProductDeleteDialogProps) {
  if (!product) return null;

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">
            Delete Product
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">
              {product.name}
            </span>
            ? This action cannot be undone.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Close>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </AlertDialog.Close>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={confirmLoading}
              type="button"
            >
              {confirmLoading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
