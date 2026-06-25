"use client";

import { AlertDialog } from "@repo/ui/base-ui";
import { Button } from "@/components/ui/button";
import type { Product } from "@repo/tenant-orm/types";

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
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Portal>
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-xl">
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
              <AlertDialog.Cancel>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Cancel>
                <Button
                  variant="destructive"
                  onClick={onConfirm}
                  disabled={confirmLoading}
                  type="button"
                >
                  {confirmLoading ? "Deleting..." : "Delete"}
                </Button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
