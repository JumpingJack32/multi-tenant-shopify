import type { InventoryItem } from "@repo/tenant-orm/types";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from "@/features/inventory/hooks/use-inventory";

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  tenantId?: string | null;
}

export function InventoryDialog({
  open,
  onOpenChange,
  item,
  tenantId,
}: InventoryDialogProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);

  const createMutation = useCreateInventoryItem(tenantId);
  const updateMutation = useUpdateInventoryItem(tenantId);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setSku(item?.sku ?? "");
      setCategory(item?.category ?? "");
      setSupplier(item?.supplier ?? "");
    }
  }, [open, item]);

  const handleSubmit = async () => {
    setSaving(true);
    const data: Record<string, unknown> = { name, sku };
    if (category) data.category = category;
    if (supplier) data.supplier = supplier;

    try {
      if (item) {
        await updateMutation.mutateAsync({ id: item.id, data });
        toast.success("Inventory item updated");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Inventory item created");
      }
      onOpenChange(false);
    } catch {
      toast.error(item ? "Failed to update item" : "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit Inventory Item" : "Add Inventory Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="inventory-name">Product Name *</Label>
            <Input
              id="inventory-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inventory-sku">SKU *</Label>
            <Input
              id="inventory-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inventory-category">Category</Label>
            <Input
              id="inventory-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inventory-supplier">Supplier</Label>
            <Input
              id="inventory-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !sku}>
            {saving ? "Saving..." : item ? "Save changes" : "Create item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
