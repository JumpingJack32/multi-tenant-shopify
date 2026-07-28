"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { Loader2Icon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

interface ProcessRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  items: Array<{
    id: string;
    product_name: string;
    variant_name?: string | null;
    quantity: number;
    unit_price: number;
  }>;
  onSuccess: () => void;
}

export function ProcessRefundModal({ open, onOpenChange, orderId, items, onSuccess }: ProcessRefundModalProps) {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState("stripe");
  const [restock, setRestock] = useState(true);
  const [warehouseNodeId, setWarehouseNodeId] = useState("");
  const [reason, setReason] = useState("");

  const { data: nodes } = useQuery({
    queryKey: ["inventory-nodes", currentTenantId],
    queryFn: () => request("/admin/inventory/nodes", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const refundMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request(`/admin/orders/${orderId}/refund`, {
        method: "POST",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onSuccess();
      onOpenChange(false);
      setQuantities({});
    },
  });

  const nodeList = (nodes ?? []) as Array<{ id: string; name: string }>;
  const refundItems = Object.entries(quantities).filter(([_, qty]) => qty > 0);
  const totalRefund = refundItems.reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item ? item.unit_price * qty : 0);
  }, 0);

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      refund_method: refundMethod,
      items: refundItems.map(([order_item_id, quantity]) => ({ order_item_id, quantity })),
      restock_inventory: restock,
      reason: reason || undefined,
    };
    if (restock && warehouseNodeId) payload.warehouse_node_id = warehouseNodeId;
    refundMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue Refund / Return</DialogTitle>
          <DialogDescription id="refund-desc">
            Select items to refund and configure the return method
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4" aria-describedby="refund-desc">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product_name}</p>
                {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                <p className="text-xs text-muted-foreground">Ordered: {item.quantity}</p>
              </div>
              <Input
                type="number"
                min={0}
                max={item.quantity}
                className="w-20 ml-4"
                placeholder="0"
                value={quantities[item.id] ?? 0}
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [item.id]: Math.min(Math.max(0, parseInt(e.target.value) || 0), item.quantity),
                  })
                }
                aria-label={`Refund quantity for ${item.product_name}`}
              />
            </div>
          ))}

          <div className="border-t pt-3">
            <Label>Refund Method</Label>
            <Select value={refundMethod} onValueChange={(v: string | null) => v && setRefundMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Original Payment (Stripe)</SelectItem>
                <SelectItem value="store_credit">Store Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Restock inventory</Label>
            <Switch checked={restock} onCheckedChange={setRestock} />
          </div>

          {restock && nodeList.length > 0 && (
            <div>
              <Label>Warehouse</Label>
              <Select value={warehouseNodeId} onValueChange={(v: string | null) => v && setWarehouseNodeId(v)}>
                <SelectTrigger><SelectValue placeholder="Select node" /></SelectTrigger>
                <SelectContent>
                  {nodeList.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer return - wrong size" />
          </div>

          {totalRefund > 0 && (
            <p className="text-sm font-semibold text-right">
              Total refund: £ {(totalRefund / 100).toFixed(2)}
            </p>
          )}

          <Button
            className="w-full"
            variant="destructive"
            onClick={handleSubmit}
            disabled={refundMutation.isPending || refundItems.length === 0}
          >
            {refundMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : `Issue Refund${totalRefund > 0 ? ` (£ ${(totalRefund / 100).toFixed(2)})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
